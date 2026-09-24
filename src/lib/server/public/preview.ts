import { and, eq } from 'drizzle-orm';
import type { PublicPostView } from '../../modules/interfaces/public.interfaces';
import type { AuthUser } from '../auth/auth';
import type { DatabaseExecutor } from '../db';
import { postRevisions } from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import { findPost, findTranslation, postSubject } from '../posts/posts';
import type { TranslationRecord } from '../posts/posts.interfaces';
import { buildPostView } from './public-posts';

export function loadPostPreview(
	db: DatabaseExecutor,
	actor: AuthUser,
	postId: string,
	languageCode: string,
	revisionId: string | null
): PublicPostView | null {
	const post = findPost(db, postId);

	if (post === null) {
		return null;
	}

	requirePermission(actor, 'post.view', postSubject(post));

	const translation = findTranslation(db, postId, languageCode);

	if (translation === null) {
		return null;
	}

	const targetId =
		revisionId ??
		translation.workingRevisionId ??
		translation.pendingRevisionId ??
		translation.liveRevisionId;

	if (targetId === null) {
		return null;
	}

	const revision = db
		.select({ slug: postRevisions.slug })
		.from(postRevisions)
		.where(and(eq(postRevisions.id, targetId), eq(postRevisions.translationId, translation.id)))
		.get();

	if (revision === undefined) {
		return null;
	}

	return buildPostView(db, {
		translationId: translation.id,
		postId,
		languageCode,
		revisionId: targetId,
		slug: previewSlug(revision.slug, translation),
		publishedAt: translation.publishedAt
	});
}

function previewSlug(revisionSlug: string, translation: TranslationRecord): string {
	if (revisionSlug !== '') {
		return revisionSlug;
	}

	return translation.slug ?? '';
}
