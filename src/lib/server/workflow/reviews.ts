import { asc, eq, isNotNull } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth';
import type { DatabaseExecutor } from '../db';
import { postRevisions, postTranslations, posts, user } from '../db/schema';
import { can, requirePermission } from '../permissions/permissions';
import { findPost, findTranslation, postSubject } from '../posts/posts';
import { tagNamesOf } from '../posts/tags';
import type { Runtime } from '../runtime.interfaces';
import type { ReviewQueueItem, ReviewRevisionView, ReviewView } from './workflow.interfaces';

export function listReviewQueue(db: DatabaseExecutor, actor: AuthUser): ReviewQueueItem[] {
	requirePermission(actor, 'review.list', null);

	return db
		.select({
			postId: postTranslations.postId,
			languageCode: postTranslations.languageCode,
			revisionId: postRevisions.id,
			title: postRevisions.title,
			ownerId: posts.ownerId,
			ownerRole: user.role,
			ownerName: user.name,
			submittedAt: postRevisions.createdAt,
			liveRevisionId: postTranslations.liveRevisionId,
			scheduledAt: postTranslations.scheduledAt
		})
		.from(postTranslations)
		.innerJoin(postRevisions, eq(postRevisions.id, postTranslations.pendingRevisionId))
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.innerJoin(user, eq(user.id, posts.ownerId))
		.where(isNotNull(postTranslations.pendingRevisionId))
		.orderBy(asc(postRevisions.createdAt))
		.all()
		.filter((row) =>
			can(actor, 'post.review', { ownerId: row.ownerId, ownerRole: row.ownerRole })
		)
		.map((row) => ({
			postId: row.postId,
			languageCode: row.languageCode,
			revisionId: row.revisionId,
			title: row.title,
			ownerName: row.ownerName,
			submittedAt: row.submittedAt,
			update: row.liveRevisionId !== null,
			scheduledAt: row.scheduledAt
		}));
}

export function loadReview(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	languageCode: string
): ReviewView | null {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return null;
	}

	requirePermission(actor, 'post.review', postSubject(post));

	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null || translation.pendingRevisionId === null) {
		return null;
	}

	const pending = reviewRevision(runtime.db, translation.pendingRevisionId);

	if (pending === null) {
		return null;
	}

	let live: ReviewRevisionView | null = null;

	if (translation.liveRevisionId !== null) {
		live = reviewRevision(runtime.db, translation.liveRevisionId);
	}

	return {
		postId,
		languageCode,
		ownerName: post.ownerName,
		status: translation.status,
		scheduledAt: translation.scheduledAt,
		pending,
		live
	};
}

function reviewRevision(db: DatabaseExecutor, revisionId: string): ReviewRevisionView | null {
	const row = db
		.select({
			id: postRevisions.id,
			title: postRevisions.title,
			slug: postRevisions.slug,
			excerpt: postRevisions.excerpt,
			metaTitle: postRevisions.metaTitle,
			metaDescription: postRevisions.metaDescription,
			ogMediaId: postRevisions.ogMediaId,
			contentHtml: postRevisions.contentHtml,
			readingTimeMinutes: postRevisions.readingTimeMinutes,
			createdAt: postRevisions.createdAt
		})
		.from(postRevisions)
		.where(eq(postRevisions.id, revisionId))
		.get();

	if (row === undefined) {
		return null;
	}

	return { ...row, tags: tagNamesOf(db, [row.id]).get(row.id) ?? [] };
}
