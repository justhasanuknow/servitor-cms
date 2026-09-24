import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env';
import {
	auditLog,
	categories,
	categoryTranslations,
	contentLanguages,
	posts,
	postTranslations
} from '../db/schema';
import { createLogger } from '../logging/logger';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import {
	addContentLanguage,
	defaultLanguageCode,
	deleteContentLanguage,
	ensureDefaultContentLanguage,
	listContentLanguages,
	setContentLanguageEnabled,
	updateContentLanguage
} from './languages';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD, role: 'author' });
});

afterEach(() => {
	harness.dispose();
});

async function actor(email: string) {
	return (await harness.signIn(email, PASSWORD)).actor;
}

function request() {
	return harness.request(new TestCookieJar());
}

function actions(): string[] {
	return harness.runtime.db
		.select({ action: auditLog.action })
		.from(auditLog)
		.all()
		.map((row) => row.action);
}

describe('the default content language', () => {
	it('is created once from the environment', () => {
		const database = createTestRuntime();
		const env = parseEnv({
			ORIGIN: 'http://localhost:4173',
			BETTER_AUTH_SECRET: 'x'.repeat(40),
			DEFAULT_CONTENT_LANGUAGE: 'tr'
		});

		ensureDefaultContentLanguage(database.runtime.db, env, createLogger('silent'));
		ensureDefaultContentLanguage(database.runtime.db, env, createLogger('silent'));

		expect(listContentLanguages(database.runtime.db)).toMatchObject([
			{ code: 'tr', name: 'Turkish', nativeName: 'Türkçe', isDefault: true, enabled: true }
		]);
		database.dispose();
	});

	it('uses English by default', () => {
		expect(defaultLanguageCode(harness.runtime.db)).toBe('en');
	});
});

describe('language management', () => {
	it('adds a language with suggested names and rejects invalid or duplicate codes', async () => {
		const admin = await actor('admin@example.com');

		expect(
			addContentLanguage(harness.runtime, request(), admin, {
				code: 'de-at',
				name: null,
				nativeName: null,
				sortOrder: 2
			})
		).toEqual({ status: 'added', code: 'de-AT' });
		expect(
			addContentLanguage(harness.runtime, request(), admin, {
				code: 'de-AT',
				name: 'Austrian German',
				nativeName: null,
				sortOrder: 0
			})
		).toEqual({ status: 'exists' });
		expect(
			addContentLanguage(harness.runtime, request(), admin, {
				code: 'klingon',
				name: null,
				nativeName: null,
				sortOrder: 0
			})
		).toEqual({ status: 'invalid_code' });
		expect(listContentLanguages(harness.runtime.db).map((language) => language.code)).toEqual([
			'en',
			'de-AT'
		]);
		expect(actions()).toContain('language.added');
	});

	it('refuses language management to authors', async () => {
		const author = await actor('author@example.com');

		expect(() =>
			addContentLanguage(harness.runtime, request(), author, {
				code: 'fr',
				name: null,
				nativeName: null,
				sortOrder: 0
			})
		).toThrow(expect.objectContaining({ status: 403 }));
	});

	it('disables other languages but never the default', async () => {
		const admin = await actor('admin@example.com');

		addContentLanguage(harness.runtime, request(), admin, {
			code: 'fr',
			name: null,
			nativeName: null,
			sortOrder: 1
		});

		expect(setContentLanguageEnabled(harness.runtime, request(), admin, 'fr', false)).toBe(
			'updated'
		);
		expect(setContentLanguageEnabled(harness.runtime, request(), admin, 'en', false)).toBe(
			'default_language'
		);
		expect(setContentLanguageEnabled(harness.runtime, request(), admin, 'fr', false)).toBe(
			'unchanged'
		);
		const french = listContentLanguages(harness.runtime.db).find((row) => row.code === 'fr');

		expect(
			updateContentLanguage(harness.runtime, request(), admin, 'fr', {
				name: french?.name ?? '',
				nativeName: french?.nativeName ?? '',
				sortOrder: french?.sortOrder ?? 0
			})
		).toBe('unchanged');
		expect(
			updateContentLanguage(harness.runtime, request(), admin, 'fr', {
				name: 'French (France)',
				nativeName: 'Français',
				sortOrder: 5
			})
		).toBe('updated');
		expect(actions()).toEqual(
			expect.arrayContaining(['language.disabled', 'language.updated'])
		);
	});

	it('deletes only unused languages that are not the default', async () => {
		const admin = await actor('admin@example.com');
		const author = await actor('author@example.com');

		for (const code of ['fr', 'de']) {
			addContentLanguage(harness.runtime, request(), admin, {
				code,
				name: null,
				nativeName: null,
				sortOrder: 0
			});
		}

		const categoryId = crypto.randomUUID();
		const postId = crypto.randomUUID();

		harness.runtime.db.insert(categories).values({ id: categoryId }).run();
		harness.runtime.db
			.insert(categoryTranslations)
			.values({ categoryId, languageCode: 'fr', name: 'Nouvelles', slug: 'nouvelles' })
			.run();
		harness.runtime.db.insert(posts).values({ id: postId, ownerId: author.id }).run();
		harness.runtime.db
			.insert(postTranslations)
			.values({ id: crypto.randomUUID(), postId, languageCode: 'de' })
			.run();

		expect(deleteContentLanguage(harness.runtime, request(), admin, 'en')).toBe(
			'default_language'
		);
		expect(deleteContentLanguage(harness.runtime, request(), admin, 'de')).toBe('in_use');
		expect(deleteContentLanguage(harness.runtime, request(), admin, 'fr')).toBe('deleted');
		expect(harness.runtime.db.select().from(categoryTranslations).all()).toHaveLength(0);
		expect(
			harness.runtime.db
				.select()
				.from(contentLanguages)
				.where(eq(contentLanguages.code, 'fr'))
				.all()
		).toHaveLength(0);
		expect(
			listContentLanguages(harness.runtime.db).find((row) => row.code === 'de')
		).toMatchObject({ translationCount: 1 });
		expect(actions()).toContain('language.deleted');
	});
});
