import { and, eq, isNotNull } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import type { DatabaseExecutor } from '../db';
import { postTranslations, posts } from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import { findPost, postSubject } from '../posts/posts';
import type { Runtime } from '../runtime.interfaces';
import { enqueuePostEvent } from '../webhooks/outbox';
import type { PostEventTranslation } from '../webhooks/outbox.interfaces';
import type { ModerationResult } from './workflow.interfaces';

export const MAX_HIDE_REASON_LENGTH = 1_000;

export function hidePost(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	postId: string,
	reason: string
): ModerationResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return 'not_found';
	}

	requirePermission(actor, 'post.moderate', postSubject(post));

	const trimmed = reason.trim();

	if (trimmed === '') {
		return 'reason_required';
	}

	if (post.hiddenByModerator) {
		return 'already_hidden';
	}

	const now = new Date();

	runtime.db.transaction((tx) => {
		tx.update(posts)
			.set({
				hiddenByModerator: true,
				hiddenBy: actor.id,
				hiddenReason: trimmed,
				hiddenAt: now,
				updatedAt: now
			})
			.where(eq(posts.id, postId))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'post.hidden',
			targetType: 'post',
			targetId: postId,
			details: { reason: trimmed },
			ip: request.ip,
			userAgent: request.userAgent
		});
		enqueuePostEvent(
			tx,
			'post.hidden',
			{ postId, translations: publishedTranslations(tx, postId) },
			now
		);
	});

	return 'hidden';
}

export function unhidePost(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	postId: string
): ModerationResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return 'not_found';
	}

	requirePermission(actor, 'post.moderate', postSubject(post));

	if (!post.hiddenByModerator) {
		return 'not_hidden';
	}

	const now = new Date();

	runtime.db.transaction((tx) => {
		tx.update(posts)
			.set({
				hiddenByModerator: false,
				hiddenBy: null,
				hiddenReason: null,
				hiddenAt: null,
				updatedAt: now
			})
			.where(eq(posts.id, postId))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'post.unhidden',
			targetType: 'post',
			targetId: postId,
			details: { previousReason: post.hiddenReason },
			ip: request.ip,
			userAgent: request.userAgent
		});
		enqueuePostEvent(
			tx,
			'post.unhidden',
			{ postId, translations: publishedTranslations(tx, postId) },
			now
		);
	});

	return 'unhidden';
}

export function publishedTranslations(
	tx: DatabaseExecutor,
	postId: string
): PostEventTranslation[] {
	return tx
		.select({ languageCode: postTranslations.languageCode, slug: postTranslations.slug })
		.from(postTranslations)
		.where(
			and(
				eq(postTranslations.postId, postId),
				eq(postTranslations.status, 'published'),
				isNotNull(postTranslations.liveRevisionId)
			)
		)
		.all();
}
