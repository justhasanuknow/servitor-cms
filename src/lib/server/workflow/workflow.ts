import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import type { DatabaseExecutor } from '../db';
import { postRevisions, postTranslations, posts } from '../db/schema';
import { can, requirePermission } from '../permissions/permissions';
import { liveSlugTaken } from '../posts/post-slugs';
import { findPost, findTranslation, postSubject } from '../posts/posts';
import type {
	PostRecord,
	TranslationDraftInput,
	TranslationRecord
} from '../posts/posts.interfaces';
import { readRevisionPayload, samePayload } from '../posts/revision-store';
import { saveTranslationDraft } from '../posts/translation-drafts';
import type { Runtime } from '../runtime.interfaces';
import { enqueuePostEvent } from '../webhooks/outbox';
import { planTransition } from './transitions';
import type { WorkflowChange, WorkflowCommand, WorkflowState } from './transitions.interfaces';
import type {
	PublishOutcome,
	PublishResult,
	ReviewDecision,
	ReviewResult,
	TranslationWorkflowView,
	UnpublishResult,
	WorkflowActor,
	WorkflowApplyResult,
	WorkflowRejection
} from './workflow.interfaces';

export const SYSTEM_ACTOR: WorkflowActor = { type: 'system', id: null, ip: null, userAgent: null };

export const MAX_REVIEW_NOTE_LENGTH = 1_000;

export function userActor(actor: AuthUser, request: AuthRequest): WorkflowActor {
	return { type: 'user', id: actor.id, ip: request.ip, userAgent: request.userAgent };
}

export function publishFromEditor(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	postId: string,
	languageCode: string,
	input: TranslationDraftInput,
	scheduledAt: Date | null
): PublishResult {
	const saved = saveTranslationDraft(runtime, actor, postId, languageCode, input, 'save');

	if (saved.status !== 'saved') {
		return saved;
	}

	const post = findPost(runtime.db, postId);
	const translation = findTranslation(runtime.db, postId, languageCode);

	if (post === null || translation === null || saved.snapshotId === null) {
		return { status: 'not_found' };
	}

	const command = editorCommand(runtime, actor, post, translation, saved.snapshotId, scheduledAt);
	const result = applyWorkflow(runtime, userActor(actor, request), translation.id, command, null);

	if (result.status !== 'ok') {
		return result;
	}

	return { status: 'done', outcome: publishOutcome(command, result.change) };
}

export function reviewSubmission(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	postId: string,
	languageCode: string,
	revisionId: string,
	decision: ReviewDecision,
	note: string | null
): ReviewResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return 'not_found';
	}

	requirePermission(actor, 'post.review', postSubject(post));

	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null) {
		return 'not_found';
	}

	if (translation.pendingRevisionId !== revisionId) {
		return 'stale';
	}

	const trimmed = note?.trim() ?? '';

	if (decision === 'reject' && trimmed === '') {
		return 'note_required';
	}

	let reviewNote: string | null = null;

	if (trimmed !== '') {
		reviewNote = trimmed;
	}

	const result = applyWorkflow(
		runtime,
		userActor(actor, request),
		translation.id,
		{ type: decision },
		reviewNote
	);

	if (result.status === 'ok') {
		if (decision === 'approve') {
			return 'approved';
		}

		return 'rejected';
	}

	return result.status;
}

export function unpublishTranslation(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	postId: string,
	languageCode: string
): UnpublishResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return 'not_found';
	}

	requirePermission(actor, 'post.edit', postSubject(post));

	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null) {
		return 'not_found';
	}

	const result = applyWorkflow(
		runtime,
		userActor(actor, request),
		translation.id,
		{ type: 'unpublish' },
		null
	);

	if (result.status === 'ok') {
		return 'unpublished';
	}

	if (result.status === 'not_found') {
		return 'not_found';
	}

	return 'not_allowed';
}

export function publishDueTranslations(runtime: Runtime, now: Date = new Date()): number {
	const due = runtime.db
		.select({ id: postTranslations.id })
		.from(postTranslations)
		.where(
			and(eq(postTranslations.status, 'scheduled'), lte(postTranslations.scheduledAt, now))
		)
		.all();
	let published = 0;

	for (const entry of due) {
		const result = applyWorkflow(
			runtime,
			SYSTEM_ACTOR,
			entry.id,
			{ type: 'run_schedule' },
			null,
			now
		);

		if (result.status === 'ok') {
			published += 1;
		}
	}

	return published;
}

export function translationWorkflowView(
	runtime: Runtime,
	actor: AuthUser,
	post: PostRecord,
	translation: TranslationRecord
): TranslationWorkflowView {
	return {
		status: translation.status,
		trusted: can(actor, 'post.publish', postSubject(post)),
		scheduledAt: translation.scheduledAt,
		publishedAt: translation.publishedAt,
		pending: translation.pendingRevisionId !== null,
		live: translation.liveRevisionId !== null,
		unchangedSinceLive: workingDraftMatchesLive(runtime.db, translation),
		rejection: activeRejection(runtime.db, translation)
	};
}

export function applyWorkflow(
	runtime: Runtime,
	actor: WorkflowActor,
	translationId: string,
	command: WorkflowCommand,
	note: string | null,
	now: Date = new Date()
): WorkflowApplyResult {
	return runtime.db.transaction((tx): WorkflowApplyResult => {
		const translation = tx
			.select()
			.from(postTranslations)
			.where(eq(postTranslations.id, translationId))
			.get();

		if (translation === undefined) {
			return { status: 'not_found' };
		}

		const outcome = planTransition(stateOf(translation), command, now);

		if (outcome.status !== 'ok') {
			return { status: 'not_allowed' };
		}

		const change = outcome.change;
		let slug = translation.slug;

		if (
			change.next.liveRevisionId !== null &&
			change.next.liveRevisionId !== translation.liveRevisionId
		) {
			const liveSlug = revisionSlug(tx, change.next.liveRevisionId);

			if (
				liveSlug === '' ||
				liveSlugTaken(tx, translation.id, translation.languageCode, liveSlug)
			) {
				return { status: 'slug_taken' };
			}

			slug = liveSlug;
		}

		tx.update(postTranslations)
			.set({ ...change.next, slug, updatedAt: now })
			.where(eq(postTranslations.id, translation.id))
			.run();
		tx.update(posts).set({ updatedAt: now }).where(eq(posts.id, translation.postId)).run();
		recordReviews(tx, change, actor, note, now);
		recordAuditEntry(tx, {
			actorType: actor.type,
			actorId: actor.id,
			action: change.audit,
			targetType: 'post',
			targetId: translation.postId,
			details: auditDetails(translation.languageCode, change, note),
			ip: actor.ip,
			userAgent: actor.userAgent
		});

		if (change.event !== null) {
			enqueuePostEvent(
				tx,
				change.event,
				{
					postId: translation.postId,
					translations: [{ languageCode: translation.languageCode, slug }]
				},
				now
			);
		}

		return { status: 'ok', change };
	});
}

function editorCommand(
	runtime: Runtime,
	actor: AuthUser,
	post: PostRecord,
	translation: TranslationRecord,
	snapshotId: string,
	scheduledAt: Date | null
): WorkflowCommand {
	if (translation.status === 'unpublished' && workingDraftMatchesLive(runtime.db, translation)) {
		return { type: 'republish', scheduledAt };
	}

	if (can(actor, 'post.publish', postSubject(post))) {
		return { type: 'publish', revisionId: snapshotId, scheduledAt };
	}

	return { type: 'submit', revisionId: snapshotId, scheduledAt };
}

function publishOutcome(command: WorkflowCommand, change: WorkflowChange): PublishOutcome {
	if (command.type === 'submit') {
		return 'submitted';
	}

	if (change.next.status === 'scheduled') {
		return 'scheduled';
	}

	if (command.type === 'republish') {
		return 'republished';
	}

	return 'published';
}

function workingDraftMatchesLive(db: DatabaseExecutor, translation: TranslationRecord): boolean {
	if (translation.liveRevisionId === null || translation.workingRevisionId === null) {
		return false;
	}

	const live = readRevisionPayload(db, translation.liveRevisionId);
	const working = readRevisionPayload(db, translation.workingRevisionId);

	return live !== null && working !== null && samePayload(live, working);
}

function activeRejection(
	db: DatabaseExecutor,
	translation: TranslationRecord
): WorkflowRejection | null {
	if (translation.pendingRevisionId !== null) {
		return null;
	}

	const row = db
		.select({
			id: postRevisions.id,
			state: postRevisions.reviewState,
			note: postRevisions.reviewNote,
			reviewedAt: postRevisions.reviewedAt
		})
		.from(postRevisions)
		.where(
			and(
				eq(postRevisions.translationId, translation.id),
				inArray(postRevisions.reviewState, ['approved', 'rejected'])
			)
		)
		.orderBy(desc(postRevisions.reviewedAt))
		.get();

	if (row === undefined || row.state !== 'rejected' || row.reviewedAt === null) {
		return null;
	}

	if (liveSince(db, translation, row.id, row.reviewedAt)) {
		return null;
	}

	return { note: row.note ?? '', reviewedAt: row.reviewedAt };
}

function liveSince(
	db: DatabaseExecutor,
	translation: TranslationRecord,
	revisionId: string,
	since: Date
): boolean {
	if (translation.liveRevisionId === null) {
		return false;
	}

	if (translation.liveRevisionId === revisionId) {
		return true;
	}

	const live = db
		.select({ createdAt: postRevisions.createdAt })
		.from(postRevisions)
		.where(eq(postRevisions.id, translation.liveRevisionId))
		.get();

	return live !== undefined && live.createdAt.getTime() > since.getTime();
}

function stateOf(translation: typeof postTranslations.$inferSelect): WorkflowState {
	return {
		status: translation.status,
		liveRevisionId: translation.liveRevisionId,
		pendingRevisionId: translation.pendingRevisionId,
		scheduledAt: translation.scheduledAt,
		publishedAt: translation.publishedAt
	};
}

function revisionSlug(tx: DatabaseExecutor, revisionId: string): string {
	const row = tx
		.select({ slug: postRevisions.slug })
		.from(postRevisions)
		.where(eq(postRevisions.id, revisionId))
		.get();

	return row?.slug ?? '';
}

function recordReviews(
	tx: DatabaseExecutor,
	change: WorkflowChange,
	actor: WorkflowActor,
	note: string | null,
	now: Date
): void {
	if (change.supersededRevisionId !== null) {
		tx.update(postRevisions)
			.set({ reviewState: 'none', reviewNote: null, reviewedBy: null, reviewedAt: null })
			.where(
				and(
					eq(postRevisions.id, change.supersededRevisionId),
					eq(postRevisions.reviewState, 'pending')
				)
			)
			.run();
	}

	if (change.reviewedRevisionId === null || change.review === null) {
		return;
	}

	if (change.review === 'pending') {
		tx.update(postRevisions)
			.set({ reviewState: 'pending', reviewNote: null, reviewedBy: null, reviewedAt: null })
			.where(eq(postRevisions.id, change.reviewedRevisionId))
			.run();

		return;
	}

	tx.update(postRevisions)
		.set({
			reviewState: change.review,
			reviewNote: note,
			reviewedBy: actor.id,
			reviewedAt: now
		})
		.where(eq(postRevisions.id, change.reviewedRevisionId))
		.run();
}

function auditDetails(
	languageCode: string,
	change: WorkflowChange,
	note: string | null
): Record<string, unknown> {
	const details: Record<string, unknown> = {
		language: languageCode,
		status: change.next.status
	};

	if (change.next.scheduledAt !== null) {
		details.scheduledAt = change.next.scheduledAt.toISOString();
	}

	if (change.review === 'rejected' && note !== null) {
		details.note = note;
	}

	return details;
}
