import { and, asc, count, eq, ne } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { slugFromText, slugOrShortId, withNumericSuffix } from '../content/slugs';
import type { AppDatabase, DatabaseExecutor } from '../db';
import { categories, categoryTranslations, contentLanguages, posts } from '../db/schema';
import { defaultLanguageCode } from '../languages/languages';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import type {
	CategoryDeleteResult,
	CategorySaveResult,
	CategoryTranslationInput,
	CategoryTranslationView,
	CategoryView,
	SlugResolution
} from './categories.interfaces';

const MAX_SLUG_ATTEMPTS = 50;

export function listCategories(db: AppDatabase): CategoryView[] {
	const translations = groupTranslations(
		db.select().from(categoryTranslations).orderBy(asc(categoryTranslations.languageCode)).all()
	);
	const usage = new Map(
		db
			.select({ categoryId: posts.categoryId, total: count() })
			.from(posts)
			.groupBy(posts.categoryId)
			.all()
			.map((row) => [row.categoryId, row.total])
	);

	return db
		.select()
		.from(categories)
		.orderBy(asc(categories.createdAt))
		.all()
		.map((row) => ({
			id: row.id,
			translations: translations.get(row.id) ?? [],
			postCount: usage.get(row.id) ?? 0,
			createdAt: row.createdAt
		}));
}

export function findCategory(db: AppDatabase, id: string): CategoryView | null {
	return listCategories(db).find((category) => category.id === id) ?? null;
}

export function createCategory(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: CategoryTranslationInput[]
): CategorySaveResult {
	requirePermission(actor, 'category.manage', null);

	const id = crypto.randomUUID();

	return saveCategory(runtime, request, actor, id, input, 'created');
}

export function updateCategory(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string,
	input: CategoryTranslationInput[]
): CategorySaveResult {
	requirePermission(actor, 'category.manage', null);

	if (!categoryExists(runtime.db, id)) {
		return { status: 'not_found' };
	}

	return saveCategory(runtime, request, actor, id, input, 'updated');
}

export function deleteCategory(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string
): CategoryDeleteResult {
	requirePermission(actor, 'category.manage', null);

	const category = findCategory(runtime.db, id);

	if (category === null) {
		return 'not_found';
	}

	if (category.postCount > 0) {
		return 'in_use';
	}

	runtime.db.transaction((tx) => {
		tx.delete(categories).where(eq(categories.id, id)).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'category.deleted',
			targetType: 'category',
			targetId: id,
			details: { names: namesOf(category.translations) },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'deleted';
}

function saveCategory(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string,
	input: CategoryTranslationInput[],
	change: 'created' | 'updated'
): CategorySaveResult {
	const entries = input.filter((entry) => entry.name.trim() !== '');
	const known = new Set(
		runtime.db
			.select({ code: contentLanguages.code })
			.from(contentLanguages)
			.all()
			.map((row) => row.code)
	);
	const unknown = entries.find((entry) => !known.has(entry.languageCode));

	if (unknown !== undefined) {
		return { status: 'unknown_language', languageCode: unknown.languageCode };
	}

	const defaultCode = defaultLanguageCode(runtime.db);

	if (!entries.some((entry) => entry.languageCode === defaultCode)) {
		return { status: 'missing_default_name' };
	}

	const resolved: CategoryTranslationView[] = [];

	for (const entry of entries) {
		const slug = resolveSlug(runtime.db, id, entry);

		if (slug.status !== 'ok') {
			return { status: slug.status, languageCode: entry.languageCode };
		}

		resolved.push({
			languageCode: entry.languageCode,
			name: entry.name.trim(),
			slug: slug.slug
		});
	}

	runtime.db.transaction((tx) => {
		if (change === 'created') {
			tx.insert(categories).values({ id }).run();
		} else {
			tx.update(categories).set({ updatedAt: new Date() }).where(eq(categories.id, id)).run();
			tx.delete(categoryTranslations).where(eq(categoryTranslations.categoryId, id)).run();
		}

		tx.insert(categoryTranslations)
			.values(resolved.map((translation) => ({ categoryId: id, ...translation })))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: `category.${change}`,
			targetType: 'category',
			targetId: id,
			details: { names: namesOf(resolved) },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return { status: 'saved', id };
}

function resolveSlug(
	db: DatabaseExecutor,
	categoryId: string,
	entry: CategoryTranslationInput
): SlugResolution {
	if (entry.slug !== null && entry.slug.trim() !== '') {
		const requested = slugFromText(entry.slug, entry.languageCode);

		if (requested === '') {
			return { status: 'invalid_slug' };
		}

		if (slugTaken(db, categoryId, entry.languageCode, requested)) {
			return { status: 'slug_taken' };
		}

		return { status: 'ok', slug: requested };
	}

	const base = slugOrShortId(entry.name, entry.languageCode);

	for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
		let candidate = base;

		if (attempt > 1) {
			candidate = withNumericSuffix(base, attempt);
		}

		if (!slugTaken(db, categoryId, entry.languageCode, candidate)) {
			return { status: 'ok', slug: candidate };
		}
	}

	return { status: 'slug_taken' };
}

function slugTaken(
	db: DatabaseExecutor,
	categoryId: string,
	languageCode: string,
	slug: string
): boolean {
	const row = db
		.select({ categoryId: categoryTranslations.categoryId })
		.from(categoryTranslations)
		.where(
			and(
				eq(categoryTranslations.languageCode, languageCode),
				eq(categoryTranslations.slug, slug),
				ne(categoryTranslations.categoryId, categoryId)
			)
		)
		.get();

	return row !== undefined;
}

function categoryExists(db: AppDatabase, id: string): boolean {
	return (
		db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).get() !==
		undefined
	);
}

function groupTranslations(
	rows: (typeof categoryTranslations.$inferSelect)[]
): Map<string, CategoryTranslationView[]> {
	const grouped = new Map<string, CategoryTranslationView[]>();

	for (const row of rows) {
		const list = grouped.get(row.categoryId) ?? [];

		list.push({ languageCode: row.languageCode, name: row.name, slug: row.slug });
		grouped.set(row.categoryId, list);
	}

	return grouped;
}

function namesOf(translations: CategoryTranslationView[]): Record<string, string> {
	return Object.fromEntries(
		translations.map((translation) => [translation.languageCode, translation.name])
	);
}
