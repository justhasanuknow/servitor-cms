import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, posts } from '../db/schema';
import { addContentLanguage, ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import {
	createCategory,
	deleteCategory,
	findCategory,
	listCategories,
	updateCategory
} from './categories';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD, role: 'author' });

	const admin = await actor('admin@example.com');

	for (const code of ['tr', 'ja']) {
		addContentLanguage(harness.runtime, request(), admin, {
			code,
			name: null,
			nativeName: null,
			sortOrder: 0
		});
	}
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

describe('categories', () => {
	it('creates per-language names with transliterated or fallback slugs', async () => {
		const admin = await actor('admin@example.com');
		const result = createCategory(harness.runtime, request(), admin, [
			{ languageCode: 'en', name: 'Travel Notes', slug: null },
			{ languageCode: 'tr', name: 'Gezi Notları', slug: null },
			{ languageCode: 'ja', name: '旅行記', slug: null }
		]);

		if (result.status !== 'saved') {
			throw new Error(`The category was not saved: ${result.status}`);
		}

		const category = findCategory(harness.runtime.db, result.id);
		const slugs = Object.fromEntries(
			category?.translations.map((translation) => [
				translation.languageCode,
				translation.slug
			]) ?? []
		);

		expect(slugs.en).toBe('travel-notes');
		expect(slugs.tr).toBe('gezi-notlari');
		expect(slugs.ja).toMatch(/^[a-z0-9]{10}$/);
		expect(
			harness.runtime.db
				.select()
				.from(auditLog)
				.all()
				.map((row) => row.action)
		).toContain('category.created');
	});

	it('keeps slugs unique per language', async () => {
		const admin = await actor('admin@example.com');

		createCategory(harness.runtime, request(), admin, [
			{ languageCode: 'en', name: 'News', slug: null }
		]);

		const second = createCategory(harness.runtime, request(), admin, [
			{ languageCode: 'en', name: 'News', slug: null }
		]);
		const explicit = createCategory(harness.runtime, request(), admin, [
			{ languageCode: 'en', name: 'Other', slug: 'news' }
		]);
		const normalized = createCategory(harness.runtime, request(), admin, [
			{ languageCode: 'en', name: 'Other', slug: 'Other Things!' }
		]);

		expect(second.status).toBe('saved');
		expect(
			listCategories(harness.runtime.db).map((category) => category.translations[0].slug)
		).toEqual(['news', 'news-2', 'other-things']);
		expect(explicit).toEqual({ status: 'slug_taken', languageCode: 'en' });
		expect(normalized.status).toBe('saved');
	});

	it('requires a name in the default language and known languages', async () => {
		const admin = await actor('admin@example.com');

		expect(
			createCategory(harness.runtime, request(), admin, [
				{ languageCode: 'tr', name: 'Haberler', slug: null }
			])
		).toEqual({ status: 'missing_default_name' });
		expect(
			createCategory(harness.runtime, request(), admin, [
				{ languageCode: 'en', name: 'News', slug: null },
				{ languageCode: 'xx', name: 'Nope', slug: null }
			])
		).toEqual({ status: 'unknown_language', languageCode: 'xx' });
		expect(
			createCategory(harness.runtime, request(), admin, [
				{ languageCode: 'en', name: 'News', slug: '!!!' }
			])
		).toEqual({ status: 'invalid_slug', languageCode: 'en' });
	});

	it('updates translations and refuses to delete a category in use', async () => {
		const admin = await actor('admin@example.com');
		const author = await actor('author@example.com');
		const created = createCategory(harness.runtime, request(), admin, [
			{ languageCode: 'en', name: 'Science', slug: null },
			{ languageCode: 'tr', name: 'Bilim', slug: null }
		]);

		if (created.status !== 'saved') {
			throw new Error('The category was not saved');
		}

		expect(
			updateCategory(harness.runtime, request(), admin, created.id, [
				{ languageCode: 'en', name: 'Science & Technology', slug: 'science-technology' }
			]).status
		).toBe('saved');
		expect(findCategory(harness.runtime.db, created.id)?.translations).toEqual([
			{ languageCode: 'en', name: 'Science & Technology', slug: 'science-technology' }
		]);

		harness.runtime.db
			.insert(posts)
			.values({ id: crypto.randomUUID(), ownerId: author.id, categoryId: created.id })
			.run();

		expect(deleteCategory(harness.runtime, request(), admin, created.id)).toBe('in_use');
		expect(() => deleteCategory(harness.runtime, request(), author, created.id)).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(deleteCategory(harness.runtime, request(), admin, crypto.randomUUID())).toBe(
			'not_found'
		);
	});

	it('deletes an unused category', async () => {
		const admin = await actor('admin@example.com');
		const created = createCategory(harness.runtime, request(), admin, [
			{ languageCode: 'en', name: 'Archive', slug: null }
		]);

		if (created.status !== 'saved') {
			throw new Error('The category was not saved');
		}

		expect(deleteCategory(harness.runtime, request(), admin, created.id)).toBe('deleted');
		expect(listCategories(harness.runtime.db)).toHaveLength(0);
	});
});
