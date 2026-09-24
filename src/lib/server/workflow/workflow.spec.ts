import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import {
	auditLog,
	postRevisions,
	postTranslations,
	posts,
	user,
	webhookDeliveries,
	webhooks
} from '../db/schema';
import { ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import { createPost, deletePost, findPost, findTranslation } from '../posts/posts';
import type { TranslationDraftInput } from '../posts/posts.interfaces';
import { loadTranslationEditor } from '../posts/translation-drafts';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import { hidePost, unhidePost } from './moderation';
import { listReviewQueue, loadReview } from './reviews';
import {
	publishDueTranslations,
	publishFromEditor,
	reviewSubmission,
	translationWorkflowView,
	unpublishTranslation
} from './workflow';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

let founder: AuthUser;

let admin: AuthUser;

let otherAdmin: AuthUser;

let author: AuthUser;

let trusted: AuthUser;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'founder@example.com', password: PASSWORD, role: 'founder' });
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'admin2@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD });
	await harness.createUser({ email: 'trusted@example.com', password: PASSWORD });
	harness.runtime.db
		.update(user)
		.set({ canPublishDirectly: true })
		.where(eq(user.email, 'trusted@example.com'))
		.run();
	founder = await signIn('founder@example.com');
	admin = await signIn('admin@example.com');
	otherAdmin = await signIn('admin2@example.com');
	author = await signIn('author@example.com');
	trusted = await signIn('trusted@example.com');
	harness.runtime.db
		.insert(webhooks)
		.values({
			url: 'https://hooks.example.com/servitor',
			events: [
				'post.published',
				'post.updated',
				'post.unpublished',
				'post.hidden',
				'post.unhidden',
				'post.deleted'
			],
			secretCiphertext: 'test',
			createdBy: founder.id
		})
		.run();
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

function newPost(owner: AuthUser): string {
	const result = createPost(harness.runtime, owner, 'en');

	if (result.status !== 'created') {
		throw new Error('Expected the post to be created');
	}

	return result.postId;
}

function draft(postId: string, owner: AuthUser, overrides: Partial<TranslationDraftInput>) {
	const translation = findTranslation(harness.runtime.db, postId, 'en');

	if (translation === null) {
		throw new Error('Expected a translation');
	}

	const current = loadTranslationEditor(harness.runtime, owner, translation).draft;

	return {
		title: current.title,
		slug: current.slug,
		excerpt: current.excerpt,
		metaTitle: null,
		metaDescription: null,
		ogMediaId: current.ogMediaId,
		tags: current.tags.join(', '),
		content: current.content,
		version: current.version,
		...overrides
	};
}

function content(text: string): string {
	return JSON.stringify({
		type: 'doc',
		content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
	});
}

function publish(
	postId: string,
	owner: AuthUser,
	overrides: Partial<TranslationDraftInput> = {},
	scheduledAt: Date | null = null
) {
	return publishFromEditor(
		harness.runtime,
		request(),
		owner,
		postId,
		'en',
		draft(postId, owner, { title: 'Title', ...overrides }),
		scheduledAt
	);
}

function translation(postId: string) {
	const current = findTranslation(harness.runtime.db, postId, 'en');

	if (current === null) {
		throw new Error('Expected a translation');
	}

	return current;
}

function revisionText(revisionId: string | null): string {
	const row = harness.runtime.db
		.select({ text: postRevisions.contentText })
		.from(postRevisions)
		.where(eq(postRevisions.id, revisionId ?? ''))
		.get();

	return row?.text ?? '';
}

function reviewState(revisionId: string | null) {
	return harness.runtime.db
		.select({ state: postRevisions.reviewState, note: postRevisions.reviewNote })
		.from(postRevisions)
		.where(eq(postRevisions.id, revisionId ?? ''))
		.get();
}

function events(): string[] {
	return harness.runtime.db
		.select({ event: webhookDeliveries.event })
		.from(webhookDeliveries)
		.all()
		.map((row) => row.event);
}

function audits(postId: string): string[] {
	return harness.runtime.db
		.select({ action: auditLog.action })
		.from(auditLog)
		.where(and(eq(auditLog.targetType, 'post'), eq(auditLog.targetId, postId)))
		.all()
		.map((row) => row.action);
}

function review(postId: string, reviewer: AuthUser, decision: 'approve' | 'reject', note = '') {
	return reviewSubmission(
		harness.runtime,
		request(),
		reviewer,
		postId,
		'en',
		translation(postId).pendingRevisionId ?? '',
		decision,
		note
	);
}

describe('trusted publishing', () => {
	it('publishes a snapshot, sets the live slug and announces it', () => {
		const postId = newPost(trusted);

		expect(publish(postId, trusted, { content: content('First version') })).toEqual({
			status: 'done',
			outcome: 'published'
		});

		const current = translation(postId);

		expect(current).toMatchObject({
			status: 'published',
			slug: 'title',
			pendingRevisionId: null
		});
		expect(current.publishedAt).not.toBeNull();
		expect(current.liveRevisionId).not.toBe(current.workingRevisionId);
		expect(revisionText(current.liveRevisionId)).toBe('First version');
		expect(audits(postId)).toEqual(['post.published']);
		expect(events()).toEqual(['post.published']);
	});

	it('announces later publishes as updates and keeps the first publish date', () => {
		const postId = newPost(trusted);

		publish(postId, trusted);

		const firstPublishedAt = translation(postId).publishedAt;

		publish(postId, trusted, { content: content('Second version') });

		expect(translation(postId).publishedAt).toEqual(firstPublishedAt);
		expect(revisionText(translation(postId).liveRevisionId)).toBe('Second version');
		expect(events()).toEqual(['post.published', 'post.updated']);
	});

	it('schedules the first publish and lets the scheduler publish it on time', () => {
		const postId = newPost(trusted);
		const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

		expect(publish(postId, trusted, {}, scheduledAt)).toEqual({
			status: 'done',
			outcome: 'scheduled'
		});
		expect(translation(postId)).toMatchObject({ status: 'scheduled', scheduledAt });
		expect(events()).toEqual([]);

		expect(publishDueTranslations(harness.runtime, new Date())).toBe(0);
		expect(
			publishDueTranslations(harness.runtime, new Date(scheduledAt.getTime() + 1000))
		).toBe(1);
		expect(translation(postId)).toMatchObject({
			status: 'published',
			scheduledAt: null,
			publishedAt: scheduledAt
		});
		expect(events()).toEqual(['post.published']);
	});

	it('rejects publishing without a title or with a taken slug', () => {
		const first = newPost(trusted);
		const second = newPost(trusted);

		publish(first, trusted, { title: 'Shared' });

		expect(publish(second, trusted, { title: '  ' })).toEqual({ status: 'title_required' });
		expect(publish(second, trusted, { title: 'Other', slug: 'shared' })).toEqual({
			status: 'slug_taken'
		});
	});
});

describe('submissions from untrusted authors', () => {
	it('sends a new translation to review and publishes it on approval', () => {
		const postId = newPost(author);

		expect(publish(postId, author, { content: content('Draft text') })).toEqual({
			status: 'done',
			outcome: 'submitted'
		});

		const pending = translation(postId);

		expect(pending).toMatchObject({
			status: 'pending_review',
			liveRevisionId: null,
			slug: null
		});
		expect(reviewState(pending.pendingRevisionId)?.state).toBe('pending');
		expect(events()).toEqual([]);

		expect(review(postId, admin, 'approve')).toBe('approved');

		const approved = translation(postId);

		expect(approved).toMatchObject({
			status: 'published',
			liveRevisionId: pending.pendingRevisionId,
			pendingRevisionId: null,
			slug: 'title'
		});
		expect(reviewState(approved.liveRevisionId)?.state).toBe('approved');
		expect(audits(postId)).toEqual(['post.submitted', 'post.approved']);
		expect(events()).toEqual(['post.published']);
	});

	it('keeps the live content unchanged while an edit after approval waits for review', () => {
		const postId = newPost(author);

		publish(postId, author, { content: content('Approved text') });
		review(postId, admin, 'approve');

		const live = translation(postId).liveRevisionId;

		expect(publish(postId, author, { content: content('Edited text') })).toEqual({
			status: 'done',
			outcome: 'submitted'
		});

		const waiting = translation(postId);

		expect(waiting.status).toBe('published');
		expect(waiting.liveRevisionId).toBe(live);
		expect(revisionText(waiting.liveRevisionId)).toBe('Approved text');
		expect(revisionText(waiting.pendingRevisionId)).toBe('Edited text');

		expect(review(postId, admin, 'approve')).toBe('approved');
		expect(revisionText(translation(postId).liveRevisionId)).toBe('Edited text');
		expect(events()).toEqual(['post.published', 'post.updated']);
	});

	it('requires a note to reject and returns never-published translations to draft', () => {
		const postId = newPost(author);

		publish(postId, author);

		const pendingId = translation(postId).pendingRevisionId;

		expect(review(postId, admin, 'reject', '   ')).toBe('note_required');
		expect(review(postId, admin, 'reject', 'Needs sources')).toBe('rejected');
		expect(translation(postId)).toMatchObject({ status: 'draft', pendingRevisionId: null });
		expect(reviewState(pendingId)).toEqual({ state: 'rejected', note: 'Needs sources' });
	});

	it('keeps the old live revision when an edit is rejected', () => {
		const postId = newPost(author);

		publish(postId, author, { content: content('Approved text') });
		review(postId, admin, 'approve');
		publish(postId, author, { content: content('Rejected text') });

		expect(review(postId, founder, 'reject', 'Not accurate')).toBe('rejected');
		expect(translation(postId)).toMatchObject({ status: 'published', pendingRevisionId: null });
		expect(revisionText(translation(postId).liveRevisionId)).toBe('Approved text');
	});

	it('refuses to review a revision that was replaced in the meantime', () => {
		const postId = newPost(author);

		publish(postId, author);

		const outdated = translation(postId).pendingRevisionId ?? '';

		publish(postId, author, { content: content('Newer') });

		expect(
			reviewSubmission(
				harness.runtime,
				request(),
				admin,
				postId,
				'en',
				outdated,
				'approve',
				null
			)
		).toBe('stale');
		expect(reviewState(outdated)?.state).toBe('none');
	});

	it('lets only staff review authors and never their own posts or admins', () => {
		const authorPost = newPost(author);
		const adminPost = newPost(admin);

		publish(authorPost, author);

		expect(() => review(authorPost, trusted, 'approve')).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(() =>
			reviewSubmission(
				harness.runtime,
				request(),
				otherAdmin,
				adminPost,
				'en',
				'x',
				'approve',
				null
			)
		).toThrow(expect.objectContaining({ status: 403 }));
		expect(listReviewQueue(harness.runtime.db, admin).map((item) => item.postId)).toEqual([
			authorPost
		]);
		expect(loadReview(harness.runtime, admin, authorPost, 'en')?.pending.title).toBe('Title');
		expect(() => listReviewQueue(harness.runtime.db, author)).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
});

describe('rejection notes', () => {
	function view(postId: string, actor: AuthUser) {
		const post = findPost(harness.runtime.db, postId);

		if (post === null) {
			throw new Error('Expected a post');
		}

		return translationWorkflowView(harness.runtime, actor, post, translation(postId));
	}

	it('shows the latest rejection until the author submits again', () => {
		const postId = newPost(author);

		publish(postId, author);
		review(postId, admin, 'reject', 'Needs sources');

		expect(view(postId, author).rejection?.note).toBe('Needs sources');

		publish(postId, author, { content: content('With sources') });

		expect(view(postId, author).rejection).toBeNull();
	});

	it('drops a rejection once newer content goes live', async () => {
		const postId = newPost(author);

		publish(postId, author);
		review(postId, admin, 'approve');
		publish(postId, author, { content: content('Rejected text') });
		review(postId, admin, 'reject', 'Not accurate');

		expect(view(postId, author).rejection?.note).toBe('Not accurate');

		await new Promise((resolve) => setTimeout(resolve, 5));

		const promoted: AuthUser = { ...author, canPublishDirectly: true };

		expect(publish(postId, promoted, { content: content('Fixed text') })).toEqual({
			status: 'done',
			outcome: 'published'
		});
		expect(view(postId, promoted).rejection).toBeNull();
	});
});

describe('unpublishing and re-publishing', () => {
	it('unpublishes for the owner only and keeps the live revision', () => {
		const postId = newPost(trusted);

		publish(postId, trusted);

		const live = translation(postId).liveRevisionId;

		expect(() => unpublishTranslation(harness.runtime, request(), admin, postId, 'en')).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(unpublishTranslation(harness.runtime, request(), trusted, postId, 'en')).toBe(
			'unpublished'
		);
		expect(translation(postId)).toMatchObject({ status: 'unpublished', liveRevisionId: live });
		expect(unpublishTranslation(harness.runtime, request(), trusted, postId, 'en')).toBe(
			'not_allowed'
		);
		expect(events()).toEqual(['post.published', 'post.unpublished']);
	});

	it('lets an untrusted owner re-publish unchanged content without approval', () => {
		const postId = newPost(author);

		publish(postId, author);
		review(postId, admin, 'approve');
		unpublishTranslation(harness.runtime, request(), author, postId, 'en');

		expect(publish(postId, author)).toEqual({ status: 'done', outcome: 'republished' });
		expect(translation(postId).status).toBe('published');
	});

	it('sends changed content from an untrusted owner back to review', () => {
		const postId = newPost(author);

		publish(postId, author);
		review(postId, admin, 'approve');
		unpublishTranslation(harness.runtime, request(), author, postId, 'en');

		expect(publish(postId, author, { content: content('Changed') })).toEqual({
			status: 'done',
			outcome: 'submitted'
		});
		expect(translation(postId).status).toBe('unpublished');
	});
});

describe('moderation', () => {
	it('lets staff hide and unhide posts they may moderate with a reason', () => {
		const postId = newPost(author);

		publish(postId, author);
		review(postId, admin, 'approve');

		expect(hidePost(harness.runtime, request(), admin, postId, ' ')).toBe('reason_required');
		expect(hidePost(harness.runtime, request(), admin, postId, 'Spam')).toBe('hidden');
		expect(hidePost(harness.runtime, request(), admin, postId, 'Again')).toBe('already_hidden');
		expect(
			harness.runtime.db.select().from(posts).where(eq(posts.id, postId)).get()
		).toMatchObject({ hiddenByModerator: true, hiddenReason: 'Spam', hiddenBy: admin.id });
		expect(() => unhidePost(harness.runtime, request(), author, postId)).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(unhidePost(harness.runtime, request(), founder, postId)).toBe('unhidden');
		expect(audits(postId)).toContain('post.hidden');
		expect(audits(postId)).toContain('post.unhidden');
		expect(events()).toEqual(['post.published', 'post.hidden', 'post.unhidden']);
	});

	it('only lets the founder moderate admins', () => {
		const postId = newPost(admin);

		expect(() => hidePost(harness.runtime, request(), otherAdmin, postId, 'x')).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(hidePost(harness.runtime, request(), founder, postId, 'Off topic')).toBe('hidden');
	});

	it('still lets the owner edit and submit a hidden post', () => {
		const postId = newPost(author);

		hidePost(harness.runtime, request(), admin, postId, 'Check facts');

		expect(publish(postId, author)).toEqual({ status: 'done', outcome: 'submitted' });
	});
});

describe('deletion events', () => {
	it('announces deleted posts with their published slugs', () => {
		const postId = newPost(trusted);

		publish(postId, trusted);
		deletePost(harness.runtime, request(), trusted, postId);

		const deleted = harness.runtime.db
			.select({ payload: webhookDeliveries.payload })
			.from(webhookDeliveries)
			.where(eq(webhookDeliveries.event, 'post.deleted'))
			.get();

		expect(JSON.parse(deleted?.payload ?? '{}')).toMatchObject({
			event: 'post.deleted',
			post_id: postId,
			languages: ['en'],
			slugs: { en: 'title' }
		});
		expect(harness.runtime.db.select().from(postTranslations).all()).toEqual([]);
	});
});
