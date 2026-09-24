import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '../auth/auth';
import {
	auditLog,
	media,
	postRevisions,
	postTranslations,
	posts,
	systemSettings,
	tags,
	user
} from '../db/schema';
import { addContentLanguage, ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import { uploadMedia } from '../media/media-library';
import { TestCookieJar } from '../testing/cookie-jar';
import { imageFile, pngImage } from '../testing/images';
import { createTestRuntime } from '../testing/runtime';
import {
	addTranslation,
	createPost,
	deletePost,
	findTranslation,
	listPosts,
	updatePostSettings
} from './posts';
import type { DraftSaveMode, TranslationDraftInput } from './posts.interfaces';
import { loadRevision, loadRevisionHistory, restoreRevision } from './revisions';
import { loadTranslationEditor, saveTranslationDraft } from './translation-drafts';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

let author: AuthUser;

let otherAuthor: AuthUser;

let admin: AuthUser;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD });
	await harness.createUser({ email: 'other@example.com', password: PASSWORD });
	admin = await signIn('admin@example.com');
	author = await signIn('author@example.com');
	otherAuthor = await signIn('other@example.com');
	addContentLanguage(harness.runtime, harness.request(new TestCookieJar()), admin, {
		code: 'tr',
		name: null,
		nativeName: null,
		sortOrder: 1
	});
});

afterEach(() => {
	harness.dispose();
});

async function signIn(email: string): Promise<AuthUser> {
	return (await harness.signIn(email, PASSWORD)).actor;
}

function newPost(actor: AuthUser = author, languageCode = 'en'): string {
	const result = createPost(harness.runtime, actor, languageCode);

	if (result.status !== 'created') {
		throw new Error(`Expected the post to be created, got ${result.status}`);
	}

	return result.postId;
}

function paragraphs(...texts: string[]): string {
	return JSON.stringify({
		type: 'doc',
		content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
	});
}

function editor(postId: string, languageCode = 'en', actor: AuthUser = author) {
	const translation = findTranslation(harness.runtime.db, postId, languageCode);

	if (translation === null) {
		throw new Error('Expected the translation to exist');
	}

	return loadTranslationEditor(harness.runtime, actor, translation);
}

function draft(
	postId: string,
	overrides: Partial<TranslationDraftInput> = {},
	languageCode = 'en'
) {
	const current = editor(postId, languageCode);

	return {
		title: current.draft.title,
		slug: current.draft.slug,
		excerpt: current.draft.excerpt,
		metaTitle: null,
		metaDescription: null,
		ogMediaId: current.draft.ogMediaId,
		tags: current.draft.tags.join(', '),
		content: current.draft.content,
		version: current.draft.version,
		...overrides
	};
}

function save(
	postId: string,
	mode: DraftSaveMode,
	overrides: Partial<TranslationDraftInput> = {},
	languageCode = 'en',
	actor: AuthUser = author
) {
	return saveTranslationDraft(
		harness.runtime,
		actor,
		postId,
		languageCode,
		draft(postId, overrides, languageCode),
		mode
	);
}

function revisionCount(postId: string): number {
	const translation = findTranslation(harness.runtime.db, postId, 'en');

	return harness.runtime.db
		.select()
		.from(postRevisions)
		.where(eq(postRevisions.translationId, translation?.id ?? ''))
		.all().length;
}

function history(postId: string, actor: AuthUser = author) {
	const loaded = loadRevisionHistory(harness.runtime, actor, postId, 'en');

	if (loaded === null) {
		throw new Error('Expected a revision history');
	}

	return loaded.revisions;
}

async function uploadImage(actor: AuthUser): Promise<string> {
	const result = await uploadMedia(
		harness.runtime,
		actor,
		imageFile(await pngImage(40, 30), 'a.png', 'image/png'),
		'library'
	);

	if (result.status !== 'uploaded') {
		throw new Error('Expected the upload to succeed');
	}

	return result.id;
}

function imageDocument(mediaId: string): string {
	return JSON.stringify({
		type: 'doc',
		content: [
			{
				type: 'image',
				attrs: { src: `/media/${mediaId}/1600.webp`, alt: '', width: 40, height: 30 }
			}
		]
	});
}

describe('creating posts and translations', () => {
	it('creates a draft translation with an empty working revision', () => {
		const postId = newPost();
		const translation = findTranslation(harness.runtime.db, postId, 'en');

		expect(translation).toMatchObject({ status: 'draft', slug: null, liveRevisionId: null });
		expect(translation?.workingRevisionId).not.toBeNull();
		expect(editor(postId).draft).toMatchObject({ title: '', slug: '', tags: [] });
		expect(revisionCount(postId)).toBe(1);
		expect(history(postId)).toEqual([]);
	});

	it('rejects unknown and disabled languages', () => {
		expect(createPost(harness.runtime, author, 'xx')).toEqual({ status: 'unknown_language' });
	});

	it('adds translations once per language for the owner only', () => {
		const postId = newPost();

		expect(addTranslation(harness.runtime, author, postId, 'tr')).toEqual({
			status: 'added',
			languageCode: 'tr'
		});
		expect(addTranslation(harness.runtime, author, postId, 'tr')).toEqual({ status: 'exists' });
		expect(addTranslation(harness.runtime, author, postId, 'de')).toEqual({
			status: 'unknown_language'
		});
		expect(() => addTranslation(harness.runtime, admin, postId, 'tr')).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
});

describe('autosave and explicit saves', () => {
	it('updates the working draft in place on autosave', () => {
		const postId = newPost();
		const result = save(postId, 'autosave', {
			title: '  Draft title ',
			content: paragraphs('Hello world')
		});

		expect(result).toMatchObject({ status: 'saved', slug: '', snapshotId: null });
		expect(revisionCount(postId)).toBe(1);
		expect(editor(postId).draft).toMatchObject({ title: 'Draft title', readingTimeMinutes: 1 });
	});

	it('rejects saves based on a stale version', () => {
		const postId = newPost();
		const stale = draft(postId, { title: 'First' });

		expect(save(postId, 'autosave', { title: 'Second' }).status).toBe('saved');
		expect(
			saveTranslationDraft(harness.runtime, author, postId, 'en', stale, 'autosave')
		).toEqual({
			status: 'conflict'
		});
	});

	it('creates a history entry and a transliterated slug on explicit saves', () => {
		const postId = newPost();
		const result = save(postId, 'save', { title: 'Größe zählt', content: paragraphs('Text') });

		expect(result).toMatchObject({ status: 'saved', slug: 'groesse-zaehlt' });
		expect(history(postId).map((revision) => revision.title)).toEqual(['Größe zählt']);
		expect(revisionCount(postId)).toBe(2);
	});

	it('does not duplicate identical history entries', () => {
		const postId = newPost();

		save(postId, 'save', { title: 'Same' });
		save(postId, 'save');

		expect(history(postId)).toHaveLength(1);
	});

	it('requires a title for explicit saves only', () => {
		const postId = newPost();

		expect(save(postId, 'save', { title: '   ' })).toEqual({ status: 'title_required' });
		expect(save(postId, 'autosave', { title: '' }).status).toBe('saved');
	});

	it('keeps slugs unique per language', () => {
		const first = newPost();
		const second = newPost(otherAuthor);

		save(first, 'save', { title: 'Hello World' });

		expect(save(second, 'save', { title: 'Hello World' }, 'en', otherAuthor)).toMatchObject({
			slug: 'hello-world-2'
		});
		expect(
			save(second, 'save', { title: 'Hello World', slug: 'hello-world' }, 'en', otherAuthor)
		).toEqual({ status: 'slug_taken' });
		expect(save(second, 'save', { slug: '!!!' }, 'en', otherAuthor)).toEqual({
			status: 'invalid_slug'
		});
		expect(save(second, 'save', { slug: 'Custom Slug' }, 'en', otherAuthor)).toMatchObject({
			slug: 'custom-slug'
		});
	});

	it('falls back to a short id for titles without a transliteration', () => {
		const postId = newPost();

		addTranslation(harness.runtime, author, postId, 'tr');

		expect(save(postId, 'save', { title: '你好世界' })).toMatchObject({
			slug: expect.stringMatching(/^[a-z0-9]{10}$/)
		});
	});

	it('normalizes and stores tags per language', () => {
		const postId = newPost();

		save(postId, 'save', { title: 'Tagged', tags: 'Travel, food ,travel,, Street Food' });

		expect(editor(postId).draft.tags).toEqual(['Street Food', 'Travel', 'food']);
		expect(
			harness.runtime.db
				.select({ slug: tags.slug })
				.from(tags)
				.all()
				.map((row) => row.slug)
				.sort()
		).toEqual(['food', 'street-food', 'travel']);
		expect(
			save(postId, 'save', { tags: Array.from({ length: 21 }, (_, i) => `t${i}`).join(',') })
		).toEqual({
			status: 'too_many_tags'
		});
	});

	it('rejects invalid content and foreign media', async () => {
		const postId = newPost();
		const foreign = await uploadImage(otherAuthor);
		const own = await uploadImage(author);

		expect(
			save(postId, 'autosave', { content: '{"type":"doc","content":[{"type":"script"}]}' })
		).toEqual({
			status: 'invalid_content'
		});
		expect(save(postId, 'autosave', { content: imageDocument(foreign) })).toEqual({
			status: 'invalid_media'
		});
		expect(save(postId, 'autosave', { ogMediaId: foreign })).toEqual({
			status: 'invalid_media'
		});
		expect(
			save(postId, 'autosave', { content: imageDocument(own), ogMediaId: own }).status
		).toBe('saved');
	});

	it('only lets the owner save drafts', () => {
		const postId = newPost();

		expect(() =>
			saveTranslationDraft(harness.runtime, admin, postId, 'en', draft(postId), 'autosave')
		).toThrow(expect.objectContaining({ status: 403 }));
	});
});

describe('revision history', () => {
	it('lists history entries newest first and lets staff view them', () => {
		const postId = newPost();

		save(postId, 'save', { title: 'One' });
		save(postId, 'save', { title: 'Two' });

		const revisions = history(postId, admin);

		expect(revisions.map((revision) => revision.title)).toEqual(['Two', 'One']);
		expect(
			loadRevision(harness.runtime, admin, postId, 'en', revisions[1].id)?.contentHtml
		).toBe('<p></p>');
		expect(() => history(postId, otherAuthor)).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});

	it('does not expose the working draft as a history entry', () => {
		const postId = newPost();
		const workingRevisionId =
			findTranslation(harness.runtime.db, postId, 'en')?.workingRevisionId ?? '';

		expect(loadRevision(harness.runtime, author, postId, 'en', workingRevisionId)).toBeNull();
	});

	it('restores a revision into the working draft without losing unsaved work', () => {
		const postId = newPost();

		save(postId, 'save', { title: 'Original', content: paragraphs('Original text') });

		const original = history(postId)[0];

		save(postId, 'autosave', { title: 'Unsaved', content: paragraphs('Unsaved text') });

		expect(restoreRevision(harness.runtime, author, postId, 'en', original.id)).toBe(
			'restored'
		);
		expect(editor(postId).draft.title).toBe('Original');
		expect(history(postId).map((revision) => revision.title)).toEqual(['Unsaved', 'Original']);
	});

	it('never lets anyone but the owner restore', () => {
		const postId = newPost();

		save(postId, 'save', { title: 'Original' });

		const revisionId = history(postId)[0].id;

		expect(() => restoreRevision(harness.runtime, admin, postId, 'en', revisionId)).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});

	it('keeps the configured number of revisions but never prunes live or pending ones', () => {
		harness.runtime.db.update(systemSettings).set({ revisionRetention: 3 }).run();

		const postId = newPost();

		save(postId, 'save', { title: 'First' });

		const firstId = history(postId)[0].id;

		harness.runtime.db
			.update(postTranslations)
			.set({ liveRevisionId: firstId, status: 'published', slug: 'first' })
			.where(eq(postTranslations.postId, postId))
			.run();

		for (const title of ['Second', 'Third', 'Fourth', 'Fifth']) {
			save(postId, 'save', { title });
		}

		expect(history(postId).map((revision) => revision.title)).toEqual([
			'Fifth',
			'Fourth',
			'Third',
			'First'
		]);
		expect(history(postId).find((revision) => revision.id === firstId)?.isLive).toBe(true);
	});
});

describe('post settings', () => {
	it('validates categories and cover media', async () => {
		const postId = newPost();
		const foreign = await uploadImage(otherAuthor);
		const own = await uploadImage(author);

		expect(
			updatePostSettings(harness.runtime, author, postId, {
				categoryId: crypto.randomUUID(),
				coverMediaId: null
			})
		).toBe('unknown_category');
		expect(
			updatePostSettings(harness.runtime, author, postId, {
				categoryId: null,
				coverMediaId: foreign
			})
		).toBe('invalid_media');
		expect(
			updatePostSettings(harness.runtime, author, postId, {
				categoryId: null,
				coverMediaId: own
			})
		).toBe('saved');
		expect(() =>
			updatePostSettings(harness.runtime, admin, postId, {
				categoryId: null,
				coverMediaId: null
			})
		).toThrow(expect.objectContaining({ status: 403 }));
	});

	it('locks category and cover for untrusted authors once a translation is live', async () => {
		const postId = newPost();
		const own = await uploadImage(author);

		save(postId, 'save', { title: 'Live' });
		harness.runtime.db
			.update(postTranslations)
			.set({ liveRevisionId: history(postId)[0].id, status: 'published', slug: 'live' })
			.where(eq(postTranslations.postId, postId))
			.run();

		expect(
			updatePostSettings(harness.runtime, author, postId, {
				categoryId: null,
				coverMediaId: own
			})
		).toBe('locked');

		harness.runtime.db
			.update(user)
			.set({ canPublishDirectly: true })
			.where(eq(user.id, author.id))
			.run();

		const trusted = await signIn('author@example.com');

		expect(
			updatePostSettings(harness.runtime, trusted, postId, {
				categoryId: null,
				coverMediaId: own
			})
		).toBe('saved');
	});
});

describe('listing and deleting posts', () => {
	it('lists own posts and lets only staff list everyone', () => {
		newPost(author);
		newPost(otherAuthor);

		expect(listPosts(harness.runtime.db, author, false, 1).total).toBe(1);
		expect(listPosts(harness.runtime.db, admin, true, 1).total).toBe(2);
		expect(() => listPosts(harness.runtime.db, author, true, 1)).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});

	it('hard-deletes the post with its translations and revisions for the owner only', async () => {
		const postId = newPost();
		const own = await uploadImage(author);
		const request = harness.request(new TestCookieJar());

		save(postId, 'save', { title: 'Doomed', content: imageDocument(own) });
		addTranslation(harness.runtime, author, postId, 'tr');

		expect(() => deletePost(harness.runtime, request, admin, postId)).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(deletePost(harness.runtime, request, author, postId)).toBe('deleted');
		expect(harness.runtime.db.select().from(posts).all()).toEqual([]);
		expect(harness.runtime.db.select().from(postTranslations).all()).toEqual([]);
		expect(harness.runtime.db.select().from(postRevisions).all()).toEqual([]);
		expect(harness.runtime.db.select().from(media).all()).toHaveLength(1);
		expect(
			harness.runtime.db
				.select({ details: auditLog.details })
				.from(auditLog)
				.where(and(eq(auditLog.action, 'post.deleted'), eq(auditLog.targetId, postId)))
				.get()?.details
		).toEqual({ titles: { en: 'Doomed', tr: '' } });
		expect(deletePost(harness.runtime, request, author, postId)).toBe('not_found');
	});
});
