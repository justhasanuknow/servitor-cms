import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '../auth/auth';
import { createCategory } from '../categories/categories';
import { contentLanguages, media, mediaAltTexts, posts, user } from '../db/schema';
import { ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import { addTranslation, deletePost, updatePostSettings } from '../posts/posts';
import { apiRequest, insertTestApiKey } from '../testing/api';
import { TestCookieJar } from '../testing/cookie-jar';
import {
	createTestPost,
	paragraphs,
	publishTestDraft,
	requireTranslation,
	saveTestDraft
} from '../testing/posts';
import { createTestRuntime, TEST_ORIGIN } from '../testing/runtime';
import { hidePost } from '../workflow/moderation';
import { reviewSubmission } from '../workflow/workflow';
import {
	authorsEndpoint,
	categoriesEndpoint,
	languagesEndpoint,
	openApiEndpoint,
	postBySlugEndpoint,
	postEndpoint,
	postsEndpoint,
	tagsEndpoint
} from './api-endpoints';

const PASSWORD = 'Kx7-quiet-harbor-19';

const IMAGE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

let harness: ReturnType<typeof createTestRuntime>;

let founder: AuthUser;

let author: AuthUser;

let writer: AuthUser;

let categoryId: string;

let spacePost: string;

let cookingPost: string;

let tokyoPost: string;

let hiddenPost: string;

let keys: Record<'all' | 'english' | 'science' | 'limited', string>;

function request() {
	return harness.request(new TestCookieJar());
}

function publish(
	owner: AuthUser,
	postId: string,
	title: string,
	text: string,
	extra = {},
	lang = 'en'
) {
	const result = publishTestDraft(
		harness.runtime,
		request(),
		owner,
		postId,
		{ title, content: paragraphs(text), ...extra },
		lang
	);

	expect(result).toMatchObject({ status: 'done' });
}

beforeEach(async () => {
	harness = createTestRuntime();

	const { db } = harness.runtime;

	ensureDefaultContentLanguage(db, harness.runtime.env, createLogger('silent'));
	db.insert(contentLanguages)
		.values([
			{ code: 'de', name: 'German', nativeName: 'Deutsch', sortOrder: 1 },
			{ code: 'ja', name: 'Japanese', nativeName: '日本語', sortOrder: 2 }
		])
		.run();
	await harness.createUser({ email: 'founder@example.com', password: PASSWORD, role: 'founder' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD, name: 'Ada' });
	await harness.createUser({ email: 'writer@example.com', password: PASSWORD, name: 'Wren' });
	db.update(user)
		.set({ canPublishDirectly: true })
		.where(eq(user.email, 'writer@example.com'))
		.run();
	founder = (await harness.signIn('founder@example.com', PASSWORD)).actor;
	author = (await harness.signIn('author@example.com', PASSWORD)).actor;
	writer = (await harness.signIn('writer@example.com', PASSWORD)).actor;

	const category = createCategory(harness.runtime, request(), founder, [
		{ languageCode: 'en', name: 'Science', slug: null },
		{ languageCode: 'de', name: 'Wissenschaft', slug: null }
	]);

	if (category.status !== 'saved') {
		throw new Error('Expected the category to be saved');
	}

	categoryId = category.id;
	db.insert(media)
		.values({
			id: IMAGE_ID,
			ownerId: writer.id,
			sourceFormat: 'png',
			width: 3200,
			height: 1600,
			byteSize: 1000
		})
		.run();
	db.insert(mediaAltTexts)
		.values([
			{ mediaId: IMAGE_ID, languageCode: 'en', altText: 'A telescope' },
			{ mediaId: IMAGE_ID, languageCode: 'de', altText: 'Ein Teleskop' }
		])
		.run();

	spacePost = createTestPost(harness.runtime, writer);
	updatePostSettings(harness.runtime, writer, spacePost, {
		categoryId,
		coverMediaId: IMAGE_ID
	});
	publish(writer, spacePost, 'Deep space', 'Hubble telescope images of galaxies', {
		excerpt: 'About telescopes',
		tags: 'Stars'
	});
	addTranslation(harness.runtime, writer, spacePost, 'de');
	publish(writer, spacePost, 'Tiefer Weltraum', 'Bilder vom Teleskop', {}, 'de');

	cookingPost = createTestPost(harness.runtime, writer);
	publish(writer, cookingPost, 'Cooking', 'A recipe with garlic');

	tokyoPost = createTestPost(harness.runtime, writer, 'ja');
	publish(writer, tokyoPost, '東京タワー', '東京の夜景', {}, 'ja');

	hiddenPost = createTestPost(harness.runtime, author);
	publish(author, hiddenPost, 'Hidden story', 'Should never leak');
	expect(
		reviewSubmission(
			harness.runtime,
			request(),
			founder,
			hiddenPost,
			'en',
			requireTranslation(harness.runtime, hiddenPost).pendingRevisionId ?? '',
			'approve',
			null
		)
	).toBe('approved');
	hidePost(harness.runtime, request(), founder, hiddenPost, 'Spam');

	const draft = createTestPost(harness.runtime, writer);

	saveTestDraft(harness.runtime, writer, draft, { title: 'Draft only' });

	keys = {
		all: insertTestApiKey(db, founder.id).key,
		english: insertTestApiKey(db, founder.id, { languages: ['en'] }).key,
		science: insertTestApiKey(db, founder.id, { categories: [categoryId] }).key,
		limited: insertTestApiKey(db, founder.id, { rateLimitPerMinute: 2 }).key
	};
});

afterEach(() => {
	harness.dispose();
});

async function call(
	endpoint: (runtime: typeof harness.runtime, event: ReturnType<typeof apiRequest>) => Response,
	path: string,
	key: string | null = keys.all,
	headers: Record<string, string> = {}
) {
	const response = endpoint(harness.runtime, apiRequest(path, key, headers));
	const text = await response.text();
	let body: unknown = null;

	if (text !== '') {
		body = JSON.parse(text);
	}

	return { response, body };
}

async function list(path: string, key: string = keys.all) {
	const { response, body } = await call(postsEndpoint, path, key);

	expect(response.status).toBe(200);

	return body as {
		data: { id: string; translations: { language: string; title: string }[] }[];
		meta: { total: number };
	};
}

function byId(id: string) {
	return (runtime: typeof harness.runtime, event: ReturnType<typeof apiRequest>) =>
		postEndpoint(runtime, event, id);
}

function bySlug(language: string, slug: string) {
	return (runtime: typeof harness.runtime, event: ReturnType<typeof apiRequest>) =>
		postBySlugEndpoint(runtime, event, language, slug);
}

function titles(body: Awaited<ReturnType<typeof list>>): string[] {
	return body.data.flatMap((post) => post.translations.map((entry) => entry.title)).sort();
}

describe('authentication', () => {
	it('requires a bearer key and uses the error shape', async () => {
		const missing = await call(postsEndpoint, '/posts', null);

		expect(missing.response.status).toBe(401);
		expect(missing.response.headers.get('www-authenticate')).toContain('Bearer');
		expect(missing.body).toEqual({
			error: { code: 'unauthorized', message: expect.any(String) }
		});
		expect((await call(postsEndpoint, '/posts', 'svt_notakey')).response.status).toBe(401);
		expect(
			(await call(postsEndpoint, '/posts', null, { authorization: `Basic ${keys.all}` }))
				.response.status
		).toBe(401);
	});

	it('rejects keys in the query string even with a valid header', async () => {
		for (const path of [
			`/posts?key=${keys.all}`,
			'/posts?api_key=abc',
			`/posts?q=${keys.all}`
		]) {
			const result = await call(postsEndpoint, path);

			expect(result.response.status).toBe(400);
			expect(result.body).toMatchObject({ error: { code: 'key_in_query' } });
		}
	});

	it('refuses revoked and expired keys', async () => {
		const revoked = insertTestApiKey(harness.runtime.db, founder.id, { revokedAt: new Date() });
		const expired = insertTestApiKey(harness.runtime.db, founder.id, {
			expiresAt: new Date(Date.now() - 1000)
		});

		expect((await call(postsEndpoint, '/posts', revoked.key)).response.status).toBe(401);
		expect((await call(postsEndpoint, '/posts', expired.key)).response.status).toBe(401);
	});

	it('limits requests per key and reports the limit', async () => {
		const first = await call(postsEndpoint, '/posts', keys.limited);

		expect(first.response.headers.get('ratelimit-limit')).toBe('2');
		expect(first.response.headers.get('ratelimit-remaining')).toBe('1');

		await call(postsEndpoint, '/posts', keys.limited);

		const limited = await call(postsEndpoint, '/posts', keys.limited);

		expect(limited.response.status).toBe(429);
		expect(Number(limited.response.headers.get('retry-after'))).toBeGreaterThan(0);
		expect(limited.body).toMatchObject({ error: { code: 'rate_limited' } });
		expect((await call(postsEndpoint, '/posts', keys.all)).response.status).toBe(200);
	});
});

describe('query validation', () => {
	it.each([
		['/posts?foo=1', 'Unknown query parameter "foo"'],
		['/posts?per_page=101', 'per_page'],
		['/posts?page=0', 'page'],
		['/posts?page=1&page=2', 'may only appear once'],
		['/posts?sort=title', 'sort'],
		['/posts?lang=xx', 'not available'],
		['/posts?published_from=yesterday', 'published_from'],
		['/posts?category=not-a-uuid', 'category']
	])('rejects %s', async (path, message) => {
		const result = await call(postsEndpoint, path);

		expect(result.response.status).toBe(400);
		expect(result.body).toMatchObject({
			error: { code: 'invalid_query', message: expect.stringContaining(message) }
		});
	});
});

describe('posts', () => {
	it('lists only publicly visible posts with pagination metadata', async () => {
		const body = await list('/posts?per_page=2');

		expect(body.meta).toEqual({ page: 1, per_page: 2, total: 3, total_pages: 2 });
		expect(titles(await list('/posts'))).toEqual([
			'Cooking',
			'Deep space',
			'Tiefer Weltraum',
			'東京タワー'
		]);
	});

	it('limits translations and posts to the key scope', async () => {
		expect(titles(await list('/posts', keys.english))).toEqual(['Cooking', 'Deep space']);
		expect(titles(await list('/posts', keys.science))).toEqual([
			'Deep space',
			'Tiefer Weltraum'
		]);

		const outOfScope = await call(postsEndpoint, '/posts?lang=de', keys.english);

		expect(outOfScope.response.status).toBe(400);
		expect(
			(await call(byId(cookingPost), `/posts/${cookingPost}`, keys.science)).response.status
		).toBe(404);
	});

	it('filters by language with an optional default-language fallback', async () => {
		expect(titles(await list('/posts?lang=de'))).toEqual(['Tiefer Weltraum']);
		expect(titles(await list('/posts?lang=de&fallback=default'))).toEqual([
			'Cooking',
			'Tiefer Weltraum'
		]);
		expect(titles(await list('/posts?lang=en,ja'))).toEqual([
			'Cooking',
			'Deep space',
			'東京タワー'
		]);
		expect(titles(await list('/posts?lang=en&lang=ja'))).toEqual([
			'Cooking',
			'Deep space',
			'東京タワー'
		]);
	});

	it('searches titles, excerpts and content in every script', async () => {
		expect(titles(await list('/posts?q=telescopes&lang=en'))).toEqual(['Deep space']);
		expect(titles(await list('/posts?q=garlic'))).toEqual(['Cooking']);
		expect(titles(await list('/posts?q=%E3%82%BF%E3%83%AF%E3%83%BC'))).toEqual(['東京タワー']);
		expect(titles(await list('/posts?q=%E5%A4%9C'))).toEqual(['東京タワー']);
		expect(titles(await list('/posts?q=leak'))).toEqual([]);
		expect(titles(await list('/posts?q=%22%22'))).toEqual([]);
	});

	it('filters by category, tag, author and publication date', async () => {
		const tags = (await call(tagsEndpoint, '/tags?lang=en')).body as {
			data: { id: string; name: string; post_count: number }[];
		};
		const stars = tags.data.find((tag) => tag.name === 'Stars');

		expect(stars?.post_count).toBe(1);
		expect(titles(await list(`/posts?category=${categoryId}&lang=en`))).toEqual(['Deep space']);
		expect(titles(await list(`/posts?tag=${stars?.id}`))).toEqual(['Deep space']);
		expect(titles(await list(`/posts?author=${author.id}`))).toEqual([]);
		expect((await list(`/posts?author=${writer.id}`)).meta.total).toBe(3);
		expect((await list('/posts?published_from=2999-01-01')).meta.total).toBe(0);
		expect((await list('/posts?published_to=2000-01-01')).meta.total).toBe(0);
	});

	it('sorts by publication date in both directions', async () => {
		const ascending = await list('/posts?sort=published_at&order=asc');
		const descending = await list('/posts?order=desc');

		expect(ascending.data.map((post) => post.id)).toEqual(
			[...descending.data.map((post) => post.id)].reverse()
		);
		expect(ascending.data[0].id).toBe(spacePost);
	});

	it('returns every in-scope translation of one post with media and content formats', async () => {
		const html = await call(byId(spacePost), `/posts/${spacePost}`);
		const post = (html.body as { data: Record<string, unknown> }).data;

		expect(post).toMatchObject({
			id: spacePost,
			author: { id: writer.id, name: 'Wren', bio: '' },
			category: {
				id: categoryId,
				translations: [
					{ language: 'en', name: 'Science', slug: 'science' },
					{ language: 'de', name: 'Wissenschaft', slug: 'wissenschaft' }
				]
			},
			cover: {
				id: IMAGE_ID,
				alt: { en: 'A telescope', de: 'Ein Teleskop' },
				variants: {
					'480': {
						url: `${TEST_ORIGIN}/media/${IMAGE_ID}/480.webp`,
						width: 480,
						height: 240
					}
				}
			}
		});
		expect(JSON.stringify(post)).not.toContain('@example.com');

		const translations = post.translations as Record<string, unknown>[];

		expect(translations.map((entry) => entry.language)).toEqual(['en', 'de']);
		expect(translations[0]).toMatchObject({
			slug: 'deep-space',
			url: `${TEST_ORIGIN}/blog/en/deep-space`,
			tags: [{ name: 'Stars', slug: 'stars' }]
		});
		expect(translations[0].content_html).toContain('Hubble');
		expect(translations[0]).not.toHaveProperty('content_json');

		const both = await call(byId(spacePost), `/posts/${spacePost}?content_format=both`);
		const bothTranslation = (both.body as { data: { translations: Record<string, unknown>[] } })
			.data.translations[0];

		expect(bothTranslation.content_json).toMatchObject({ type: 'doc' });
		expect(bothTranslation.content_html).toContain('Hubble');

		const english = await call(byId(spacePost), `/posts/${spacePost}`, keys.english);

		expect(
			(english.body as { data: { translations: unknown[] } }).data.translations
		).toHaveLength(1);
	});

	it('finds a post by the slug of any translation', async () => {
		const result = await call(
			bySlug('de', 'tiefer-weltraum'),
			'/posts/by-slug/de/tiefer-weltraum'
		);

		expect(result.response.status).toBe(200);
		expect(result.body).toMatchObject({
			data: { id: spacePost, translations: [{ language: 'en' }, { language: 'de' }] }
		});
		expect(
			(await call(bySlug('xx', 'tiefer-weltraum'), '/posts/by-slug/xx/tiefer-weltraum'))
				.response.status
		).toBe(404);
		expect(
			(await call(bySlug('de', 'Not_A_Slug'), '/posts/by-slug/de/Not_A_Slug')).response.status
		).toBe(404);
	});

	it('answers 404 for hidden, unknown and out-of-scope posts', async () => {
		expect((await call(byId(hiddenPost), `/posts/${hiddenPost}`)).response.status).toBe(404);
		expect((await call(byId('not-a-uuid'), '/posts/not-a-uuid')).response.status).toBe(404);
		expect(
			(await call(byId(tokyoPost), `/posts/${tokyoPost}`, keys.english)).response.status
		).toBe(404);
	});

	it('supports conditional requests', async () => {
		const first = await call(postsEndpoint, '/posts');
		const etag = first.response.headers.get('etag') ?? '';
		const lastModified = first.response.headers.get('last-modified') ?? '';

		expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/);
		expect(lastModified).not.toBe('');
		expect(first.response.headers.get('cache-control')).toBe('private, no-cache');
		expect(
			(await call(postsEndpoint, '/posts', keys.all, { 'if-none-match': etag })).response
				.status
		).toBe(304);
		expect(
			(await call(postsEndpoint, '/posts', keys.all, { 'if-modified-since': lastModified }))
				.response.status
		).toBe(304);
		expect(
			(await call(postsEndpoint, '/posts', keys.all, { 'if-none-match': '"other"' })).response
				.status
		).toBe(200);
	});

	it('keeps the search index in step with deletions', async () => {
		deletePost(harness.runtime, request(), writer, cookingPost);

		expect(titles(await list('/posts?q=garlic'))).toEqual([]);
		expect(
			harness.runtime.db.get<{ total: number }>(
				sql`select count(*) as total from post_search`
			).total
		).toBe(4);
		expect(harness.runtime.db.select().from(posts).where(eq(posts.id, cookingPost)).get()).toBe(
			undefined
		);
	});
});

describe('languages, categories, tags and authors', () => {
	it('lists enabled languages within the key scope', async () => {
		const all = (await call(languagesEndpoint, '/languages')).body as {
			data: { code: string; is_default: boolean }[];
		};
		const english = (await call(languagesEndpoint, '/languages', keys.english)).body as {
			data: { code: string }[];
		};

		expect(all.data.map((language) => language.code)).toEqual(['en', 'de', 'ja']);
		expect(all.data[0].is_default).toBe(true);
		expect(english.data.map((language) => language.code)).toEqual(['en']);
	});

	it('lists categories with the names of in-scope languages', async () => {
		const english = (await call(categoriesEndpoint, '/categories', keys.english)).body as {
			data: { translations: { language: string }[] }[];
		};

		expect(english.data).toHaveLength(1);
		expect(english.data[0].translations.map((entry) => entry.language)).toEqual(['en']);
	});

	it('requires a language for tags and counts only public posts', async () => {
		expect((await call(tagsEndpoint, '/tags')).response.status).toBe(400);
		expect((await call(tagsEndpoint, '/tags?lang=de', keys.english)).response.status).toBe(400);
		expect(
			((await call(tagsEndpoint, '/tags?lang=de')).body as { data: unknown[] }).data
		).toEqual([]);
	});

	it('lists public author profiles without email addresses', async () => {
		const authors = (await call(authorsEndpoint, '/authors')).body as {
			data: Record<string, unknown>[];
		};

		expect(authors.data).toEqual([{ id: writer.id, name: 'Wren', bio: '', avatar: null }]);
	});
});

describe('documentation', () => {
	it('serves the OpenAPI document without a key', async () => {
		const result = await call(openApiEndpoint, '/openapi.json', null);

		expect(result.response.status).toBe(200);
		expect(result.body).toMatchObject({ openapi: '3.1.0' });
	});
});
