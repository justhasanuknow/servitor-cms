import { and, desc, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth';
import { renderContent } from '../content/render-content';
import type { DatabaseExecutor } from '../db';
import { postRevisions, postTranslations, posts, user } from '../db/schema';
import { unusableMediaIds } from '../media/media-library';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import { loadSystemSettings } from '../settings/system-settings';
import { postSlugTaken } from './post-slugs';
import { findPost, findTranslation, postSubject } from './posts';
import type { PostRecord, TranslationRecord } from './posts.interfaces';
import {
	historyFilter,
	insertRevision,
	latestSnapshotId,
	pruneRevisions,
	readRevisionPayload,
	samePayload,
	writeRevision
} from './revision-store';
import type { RevisionPayload, TranslationPointers } from './revision-store.interfaces';
import type {
	RevisionDetail,
	RevisionHistory,
	RevisionListItem,
	RevisionRestoreResult
} from './revisions.interfaces';
import { tagNamesOf } from './tags';
import { ensureWorkingRevision } from './translation-drafts';

export function loadRevisionHistory(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	languageCode: string
): RevisionHistory | null {
	const target = viewableTranslation(runtime, actor, postId, languageCode);

	if (target === null) {
		return null;
	}

	const rows = runtime.db
		.select({
			id: postRevisions.id,
			title: postRevisions.title,
			authorName: user.name,
			reviewState: postRevisions.reviewState,
			reviewNote: postRevisions.reviewNote,
			createdAt: postRevisions.createdAt
		})
		.from(postRevisions)
		.innerJoin(user, eq(user.id, postRevisions.authorId))
		.where(historyFilter(target.translation))
		.orderBy(desc(postRevisions.createdAt), desc(postRevisions.id))
		.all();
	const revisions: RevisionListItem[] = rows.map((row) => ({
		...row,
		isLive: row.id === target.translation.liveRevisionId,
		isPending: row.id === target.translation.pendingRevisionId
	}));

	return { post: target.post, translation: target.translation, revisions };
}

export function loadRevision(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	languageCode: string,
	revisionId: string
): RevisionDetail | null {
	const target = viewableTranslation(runtime, actor, postId, languageCode);

	if (target === null) {
		return null;
	}

	const row = runtime.db
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
			reviewState: postRevisions.reviewState,
			reviewNote: postRevisions.reviewNote,
			authorName: user.name,
			createdAt: postRevisions.createdAt
		})
		.from(postRevisions)
		.innerJoin(user, eq(user.id, postRevisions.authorId))
		.where(and(historyFilter(target.translation), eq(postRevisions.id, revisionId)))
		.get();

	if (row === undefined) {
		return null;
	}

	return {
		...row,
		post: target.post,
		translation: target.translation,
		tags: tagNamesOf(runtime.db, [row.id]).get(row.id) ?? [],
		isLive: row.id === target.translation.liveRevisionId,
		isPending: row.id === target.translation.pendingRevisionId
	};
}

export function restoreRevision(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	languageCode: string,
	revisionId: string
): RevisionRestoreResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return 'not_found';
	}

	requirePermission(actor, 'revision.restore', postSubject(post));

	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null) {
		return 'not_found';
	}

	const source = historyRevision(runtime.db, translation, revisionId);

	if (source === null) {
		return 'not_found';
	}

	const rendered = renderContent(source.contentJson);

	if (rendered.status !== 'rendered') {
		return 'invalid_content';
	}

	const mediaIds = [...rendered.content.mediaIds];

	if (source.ogMediaId !== null) {
		mediaIds.push(source.ogMediaId);
	}

	if (unusableMediaIds(runtime.db, actor, mediaIds).length > 0) {
		return 'invalid_media';
	}

	const retention = loadSystemSettings(runtime.db).revisionRetention;

	runtime.db.transaction((tx) => {
		const workingRevisionId = ensureWorkingRevision(tx, translation, actor.id);
		const pointers: TranslationPointers = { ...translation, workingRevisionId };
		const current = readRevisionPayload(tx, workingRevisionId);
		const latest = latestSnapshotId(tx, pointers);
		let latestPayload: RevisionPayload | null = null;

		if (latest !== null) {
			latestPayload = readRevisionPayload(tx, latest);
		}

		if (current !== null && (latestPayload === null || !samePayload(current, latestPayload))) {
			insertRevision(tx, translation.id, languageCode, actor.id, current);
		}

		let slug = source.slug;

		if (slug !== '' && postSlugTaken(tx, translation.id, languageCode, slug)) {
			slug = '';
		}

		writeRevision(tx, workingRevisionId, languageCode, actor.id, {
			...source,
			slug,
			contentJson: rendered.content.json,
			contentHtml: rendered.content.html,
			contentText: rendered.content.text,
			readingTimeMinutes: rendered.content.readingTimeMinutes,
			mediaIds: rendered.content.mediaIds
		});
		pruneRevisions(tx, pointers, retention);

		const now = new Date();

		tx.update(postTranslations)
			.set({ updatedAt: now })
			.where(eq(postTranslations.id, translation.id))
			.run();
		tx.update(posts).set({ updatedAt: now }).where(eq(posts.id, postId)).run();
	});

	return 'restored';
}

function viewableTranslation(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	languageCode: string
): { post: PostRecord; translation: TranslationRecord } | null {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return null;
	}

	requirePermission(actor, 'post.view', postSubject(post));

	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null) {
		return null;
	}

	return { post, translation };
}

function historyRevision(
	db: DatabaseExecutor,
	translation: TranslationRecord,
	revisionId: string
): RevisionPayload | null {
	const row = db
		.select({ id: postRevisions.id })
		.from(postRevisions)
		.where(and(historyFilter(translation), eq(postRevisions.id, revisionId)))
		.get();

	if (row === undefined) {
		return null;
	}

	return readRevisionPayload(db, row.id);
}
