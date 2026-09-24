import { asc, count, eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import type { Env } from '../config/env';
import type { AppDatabase, DatabaseExecutor } from '../db';
import { contentLanguages, postTranslations } from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import { canonicalLanguageTag, suggestLanguageNames } from './language-tags';
import type {
	AddLanguageResult,
	ContentLanguageView,
	LanguageChangeResult,
	LanguageDeleteResult,
	LanguageUpdateInput,
	NewLanguageInput
} from './languages.interfaces';

export function listContentLanguages(db: AppDatabase): ContentLanguageView[] {
	const usage = new Map(
		db
			.select({ code: postTranslations.languageCode, total: count() })
			.from(postTranslations)
			.groupBy(postTranslations.languageCode)
			.all()
			.map((row) => [row.code, row.total])
	);

	return db
		.select()
		.from(contentLanguages)
		.orderBy(asc(contentLanguages.sortOrder), asc(contentLanguages.name))
		.all()
		.map((row) => ({
			code: row.code,
			name: row.name,
			nativeName: row.nativeName,
			enabled: row.enabled,
			isDefault: row.isDefault,
			sortOrder: row.sortOrder,
			translationCount: usage.get(row.code) ?? 0
		}));
}

export function listEnabledLanguages(db: AppDatabase): ContentLanguageView[] {
	return listContentLanguages(db).filter((language) => language.enabled);
}

export function defaultLanguageCode(db: DatabaseExecutor): string | null {
	const row = db
		.select({ code: contentLanguages.code })
		.from(contentLanguages)
		.where(eq(contentLanguages.isDefault, true))
		.get();

	return row?.code ?? null;
}

export function addContentLanguage(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: NewLanguageInput
): AddLanguageResult {
	requirePermission(actor, 'language.manage', null);

	const code = canonicalLanguageTag(input.code);

	if (code === null) {
		return { status: 'invalid_code' };
	}

	if (findLanguage(runtime.db, code) !== undefined) {
		return { status: 'exists' };
	}

	const suggested = suggestLanguageNames(code);

	runtime.db.transaction((tx) => {
		tx.insert(contentLanguages)
			.values({
				code,
				name: input.name ?? suggested.name,
				nativeName: input.nativeName ?? suggested.nativeName,
				enabled: true,
				isDefault: false,
				sortOrder: input.sortOrder
			})
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'language.added',
			targetType: 'language',
			targetId: code,
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return { status: 'added', code };
}

export function updateContentLanguage(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	code: string,
	input: LanguageUpdateInput
): LanguageChangeResult {
	requirePermission(actor, 'language.manage', null);

	const language = findLanguage(runtime.db, code);

	if (language === undefined) {
		return 'not_found';
	}

	if (
		language.name === input.name &&
		language.nativeName === input.nativeName &&
		language.sortOrder === input.sortOrder
	) {
		return 'unchanged';
	}

	runtime.db.transaction((tx) => {
		tx.update(contentLanguages)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(contentLanguages.code, code))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'language.updated',
			targetType: 'language',
			targetId: code,
			details: { ...input },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'updated';
}

export function setContentLanguageEnabled(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	code: string,
	enabled: boolean
): LanguageChangeResult {
	requirePermission(actor, 'language.manage', null);

	const language = findLanguage(runtime.db, code);

	if (language === undefined) {
		return 'not_found';
	}

	if (language.isDefault && !enabled) {
		return 'default_language';
	}

	if (language.enabled === enabled) {
		return 'unchanged';
	}

	runtime.db.transaction((tx) => {
		tx.update(contentLanguages)
			.set({ enabled, updatedAt: new Date() })
			.where(eq(contentLanguages.code, code))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: enabledAction(enabled),
			targetType: 'language',
			targetId: code,
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'updated';
}

export function deleteContentLanguage(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	code: string
): LanguageDeleteResult {
	requirePermission(actor, 'language.manage', null);

	const language = findLanguage(runtime.db, code);

	if (language === undefined) {
		return 'not_found';
	}

	if (language.isDefault) {
		return 'default_language';
	}

	const usage = runtime.db
		.select({ total: count() })
		.from(postTranslations)
		.where(eq(postTranslations.languageCode, code))
		.get();

	if ((usage?.total ?? 0) > 0) {
		return 'in_use';
	}

	runtime.db.transaction((tx) => {
		tx.delete(contentLanguages).where(eq(contentLanguages.code, code)).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'language.deleted',
			targetType: 'language',
			targetId: code,
			details: { name: language.name },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'deleted';
}

export function makeDefaultLanguage(db: DatabaseExecutor, code: string): void {
	db.update(contentLanguages)
		.set({ isDefault: false, updatedAt: new Date() })
		.where(eq(contentLanguages.isDefault, true))
		.run();
	db.update(contentLanguages)
		.set({ isDefault: true, enabled: true, updatedAt: new Date() })
		.where(eq(contentLanguages.code, code))
		.run();
}

export function ensureDefaultContentLanguage(db: AppDatabase, env: Env, logger: Logger): void {
	const existing = db.select({ code: contentLanguages.code }).from(contentLanguages).get();

	if (existing) {
		return;
	}

	const code = env.DEFAULT_CONTENT_LANGUAGE;
	const names = suggestLanguageNames(code);

	db.transaction((tx) => {
		tx.insert(contentLanguages)
			.values({ code, ...names, enabled: true, isDefault: true, sortOrder: 0 })
			.run();
		recordAuditEntry(tx, {
			actorType: 'system',
			action: 'language.added',
			targetType: 'language',
			targetId: code,
			details: { source: 'environment', isDefault: true }
		});
	});

	logger.info({ code }, 'Default content language created from the environment');
}

function findLanguage(db: DatabaseExecutor, code: string) {
	return db.select().from(contentLanguages).where(eq(contentLanguages.code, code)).get();
}

function enabledAction(enabled: boolean): 'language.enabled' | 'language.disabled' {
	if (enabled) {
		return 'language.enabled';
	}

	return 'language.disabled';
}
