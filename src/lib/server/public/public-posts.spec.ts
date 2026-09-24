import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PUBLIC_PAGE_SIZE } from '../../constants/public';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { createCategory } from '../categories/categories';
import { contentLanguages, user } from '../db/schema';
import { ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import { addTranslation, updatePostSettings } from '../posts/posts';
import { TestCookieJar } from '../testing/cookie-jar';
import {
	createTestPost,
	paragraphs,
	publishTestDraft,
	requireTranslation,
	saveTestDraft
} from '../testing/posts';
import { createTestRuntime } from '../testing/runtime';
import { hidePost, unhidePost } from '../workflow/moderation';
import { reviewSubmission, unpublishTranslation } from '../workflow/workflow';
import { loadPostPreview } from './preview';
import {
	findPublicCategory,
	findPublicLanguage,
	findPublicPost,
	findPublicTag,
	listFeedItems,
	listPublicPosts,
	listSitemapEntries
} from './public-posts';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

let founder: AuthUser;

let author: AuthUser;

let otherAuthor: AuthUser;

let trusted: AuthUser;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'founder@example.com', password: PASSWORD, role: 'founder' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD, name: 'Ada' });
	await harness.createUser({ email: 'other@example.com', password: PASSWORD });
	await harness.createUser({ email: 'trusted@example.com', password: PASSWORD, name: 'Tess' });
	harness.runtime.db
		.update(user)
		.set({ canPublishDirectly: true })
		.where(eq(user.email, 'trusted@example.com'))
		.run();
	founder = await signIn('founder@example.com');
	author = await signIn('author@example.com');
	otherAuthor = await signIn('other@example.com');
	trusted = await signIn('trusted@example.com');
});

afterEach(() => {
	harness.dispose();
});

async function signIn(email: string): Promise<AuthUser> {
	return (await harness.signIn(email, PASSWORD)).actor;
}

function request(): AuthRequest {
	return harness.request(new TestCookieJar());
}

function published(title: string, owner: AuthUser = trusted, text = `${title} body`): string {
	const postId = createTestPost(harness.runtime, owner);
	const result = publishTestDraft(harness.runtime, request(), owner, postId, {
		title,
		content: paragraphs(text)
	});

	expect(result).toMatchObject({ status: 'done' });

	return postId;
}

function approve(postId: string): void {
	const pending = requireTranslation(harness.runtime, postId).pendingRevisionId ?? '';

	expect(
		reviewSubmission(
			harness.runtime,
			request(),
			founder,
			postId,
			'en',
			pending,
			'approve',
			null
		)
	).toBe('approved');
}

function publicTitles(languageCode = 'en'): string[] {
	return (listPublicPosts(harness.runtime.db, languageCode, 1)?.items ?? []).map(
		(item) => item.title
	);
}

function slugOf(postId: string, languageCode = 'en'): string {
	return requireTranslation(harness.runtime, postId, languageCode).slug ?? '';
}

describe('public posts', () => {
	it('serves published translations with their live content, tags and author', () => {
		const postId = createTestPost(harness.runtime, trusted);

		publishTestDraft(harness.runtime, request(), trusted, postId, {
			title: 'Visible post',
			excerpt: 'A short summary',
			tags: 'Science, Space',
			content: paragraphs('Visible body')
		});

		const listing = listPublicPosts(harness.runtime.db, 'en', 1);

		expect(listing).toMatchObject({ page: 1, pageCount: 1, total: 1 });
		expect(listing?.items[0]).toMatchObject({
			title: 'Visible post',
			slug: 'visible-post',
			excerpt: 'A short summary',
			authorName: 'Tess'
		});

		const post = findPublicPost(harness.runtime.db, 'en', 'visible-post');

		expect(post?.contentHtml).toContain('Visible body');
		expect(post?.tags).toEqual([
			{ name: 'Science', slug: 'science' },
			{ name: 'Space', slug: 'space' }
		]);
		expect(post?.alternates).toEqual([
			{ languageCode: 'en', nativeName: 'English', slug: 'visible-post' }
		]);
		expect(post?.publishedAt).not.toBeNull();
	});

	it('never exposes drafts, submissions, scheduled or unpublished translations', () => {
		const visible = published('Visible');
		const draftPost = createTestPost(harness.runtime, trusted);
		const pendingPost = createTestPost(harness.runtime, author);
		const scheduledPost = createTestPost(harness.runtime, trusted);
		const unpublishedPost = published('Withdrawn');

		saveTestDraft(harness.runtime, trusted, draftPost, { title: 'Only a draft' });
		publishTestDraft(harness.runtime, request(), author, pendingPost, { title: 'Waiting' });
		publishTestDraft(
			harness.runtime,
			request(),
			trusted,
			scheduledPost,
			{ title: 'Later' },
			'en',
			new Date(Date.now() + 60 * 60 * 1000)
		);
		unpublishTranslation(harness.runtime, request(), trusted, unpublishedPost, 'en');

		expect(publicTitles()).toEqual(['Visible']);
		expect(listFeedItems(harness.runtime.db, 'en').map((item) => item.title)).toEqual([
			'Visible'
		]);
		expect(listSitemapEntries(harness.runtime.db, 'en').map((entry) => entry.slug)).toEqual([
			slugOf(visible)
		]);
		expect(findPublicPost(harness.runtime.db, 'en', slugOf(scheduledPost))).toBeNull();
		expect(findPublicPost(harness.runtime.db, 'en', slugOf(unpublishedPost))).toBeNull();
		expect(findPublicPost(harness.runtime.db, 'en', 'only-a-draft')).toBeNull();
		expect(findPublicPost(harness.runtime.db, 'en', 'waiting')).toBeNull();
	});

	it('hides every language of a moderated post until it is unhidden', () => {
		const postId = createTestPost(harness.runtime, author);

		publishTestDraft(harness.runtime, request(), author, postId, { title: 'Moderated' });
		approve(postId);

		expect(publicTitles()).toEqual(['Moderated']);

		hidePost(harness.runtime, request(), founder, postId, 'Spam');

		expect(publicTitles()).toEqual([]);
		expect(findPublicPost(harness.runtime.db, 'en', 'moderated')).toBeNull();
		expect(listFeedItems(harness.runtime.db, 'en')).toEqual([]);
		expect(listSitemapEntries(harness.runtime.db, 'en')).toEqual([]);

		unhidePost(harness.runtime, request(), founder, postId);

		expect(publicTitles()).toEqual(['Moderated']);
	});

	it('keeps serving the live revision while changes wait for review', () => {
		const postId = createTestPost(harness.runtime, author);

		publishTestDraft(harness.runtime, request(), author, postId, {
			title: 'Reviewed',
			content: paragraphs('Approved text')
		});
		approve(postId);
		publishTestDraft(harness.runtime, request(), author, postId, {
			content: paragraphs('Pending text')
		});

		const post = findPublicPost(harness.runtime.db, 'en', 'reviewed');

		expect(post?.contentHtml).toContain('Approved text');
		expect(post?.contentHtml).not.toContain('Pending text');
	});

	it('drops translations in disabled languages from listings and alternates', () => {
		harness.runtime.db
			.insert(contentLanguages)
			.values({ code: 'de', name: 'German', nativeName: 'Deutsch', sortOrder: 1 })
			.run();

		const postId = published('English version');

		addTranslation(harness.runtime, trusted, postId, 'de');
		publishTestDraft(
			harness.runtime,
			request(),
			trusted,
			postId,
			{ title: 'Deutsche Fassung' },
			'de'
		);

		expect(publicTitles('de')).toEqual(['Deutsche Fassung']);
		expect(
			findPublicPost(harness.runtime.db, 'en', 'english-version')?.alternates.map(
				(alternate) => alternate.languageCode
			)
		).toEqual(['en', 'de']);

		harness.runtime.db
			.update(contentLanguages)
			.set({ enabled: false })
			.where(eq(contentLanguages.code, 'de'))
			.run();

		expect(findPublicLanguage(harness.runtime.db, 'de')).toBeNull();
		expect(publicTitles('de')).toEqual([]);
		expect(findPublicPost(harness.runtime.db, 'de', 'deutsche-fassung')).toBeNull();
		expect(
			findPublicPost(harness.runtime.db, 'en', 'english-version')?.alternates.map(
				(alternate) => alternate.languageCode
			)
		).toEqual(['en']);
	});

	it('keeps posts of deactivated owners public', () => {
		published('Still here', trusted);
		harness.runtime.db
			.update(user)
			.set({ deactivatedAt: new Date() })
			.where(eq(user.id, trusted.id))
			.run();

		expect(publicTitles()).toEqual(['Still here']);
	});

	it('paginates listings and rejects pages past the end', () => {
		for (let index = 1; index <= PUBLIC_PAGE_SIZE + 2; index += 1) {
			published(`Post ${index}`);
		}

		expect(listPublicPosts(harness.runtime.db, 'en', 1)?.items).toHaveLength(PUBLIC_PAGE_SIZE);
		expect(listPublicPosts(harness.runtime.db, 'en', 2)).toMatchObject({
			page: 2,
			pageCount: 2,
			total: PUBLIC_PAGE_SIZE + 2
		});
		expect(listPublicPosts(harness.runtime.db, 'en', 2)?.items).toHaveLength(2);
		expect(listPublicPosts(harness.runtime.db, 'en', 3)).toBeNull();
		expect(listPublicPosts(harness.runtime.db, 'fr', 1)).toMatchObject({ items: [], total: 0 });
	});
});

describe('categories and tags', () => {
	it('lists posts by category and by tag', () => {
		const category = createCategory(harness.runtime, request(), founder, [
			{ languageCode: 'en', name: 'Astronomy', slug: null }
		]);

		if (category.status !== 'saved') {
			throw new Error('Expected the category to be saved');
		}

		const inCategory = createTestPost(harness.runtime, trusted);

		updatePostSettings(harness.runtime, trusted, inCategory, {
			categoryId: category.id,
			coverMediaId: null
		});
		publishTestDraft(harness.runtime, request(), trusted, inCategory, {
			title: 'Stars',
			tags: 'Night sky'
		});
		published('Elsewhere');

		const term = findPublicCategory(harness.runtime.db, 'en', 'astronomy');

		expect(term).toEqual({ id: category.id, name: 'Astronomy', slug: 'astronomy' });
		expect(
			listPublicPosts(harness.runtime.db, 'en', 1, { categoryId: category.id })?.items.map(
				(item) => item.title
			)
		).toEqual(['Stars']);
		expect(findPublicPost(harness.runtime.db, 'en', 'stars')?.category).toEqual({
			name: 'Astronomy',
			slug: 'astronomy'
		});

		const tag = findPublicTag(harness.runtime.db, 'en', 'night-sky');

		expect(tag?.name).toBe('Night sky');
		expect(
			listPublicPosts(harness.runtime.db, 'en', 1, { tagId: tag?.id ?? '' })?.items.map(
				(item) => item.title
			)
		).toEqual(['Stars']);
	});

	it('does not reveal tags that only drafts use', () => {
		const draft = createTestPost(harness.runtime, trusted);

		saveTestDraft(harness.runtime, trusted, draft, { title: 'Draft', tags: 'Secret plan' });

		expect(findPublicTag(harness.runtime.db, 'en', 'secret-plan')).toBeNull();
	});
});

describe('previews', () => {
	it('shows the owner the working draft and staff the submitted revision', () => {
		const postId = createTestPost(harness.runtime, author);

		publishTestDraft(harness.runtime, request(), author, postId, {
			title: 'Submitted',
			content: paragraphs('Submitted text')
		});
		saveTestDraft(harness.runtime, author, postId, { content: paragraphs('Newer draft') });

		const pendingId = requireTranslation(harness.runtime, postId).pendingRevisionId;

		expect(
			loadPostPreview(harness.runtime.db, author, postId, 'en', null)?.contentHtml
		).toContain('Newer draft');
		expect(
			loadPostPreview(harness.runtime.db, founder, postId, 'en', pendingId)?.contentHtml
		).toContain('Submitted text');
		expect(() => loadPostPreview(harness.runtime.db, otherAuthor, postId, 'en', null)).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});

	it('refuses revisions that belong to another translation', () => {
		const first = createTestPost(harness.runtime, author);
		const second = createTestPost(harness.runtime, author);

		saveTestDraft(harness.runtime, author, first, { title: 'First' });

		const foreign = requireTranslation(harness.runtime, first).workingRevisionId;

		expect(loadPostPreview(harness.runtime.db, author, second, 'en', foreign)).toBeNull();
	});
});
