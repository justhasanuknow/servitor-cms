import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth';
import { emptyContentDocument } from '../content/content-schema';
import { renderContent, renderContentDocument } from '../content/render-content';
import type { RenderedContent } from '../content/render-content.interfaces';
import type { DatabaseExecutor } from '../db';
import { postRevisions, postTranslations, posts } from '../db/schema';
import { unusableMediaIds } from '../media/media-library';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import { loadSystemSettings } from '../settings/system-settings';
import { resolvePostSlug } from './post-slugs';
import type {
	DraftSaveMode,
	DraftSaveResult,
	TranslationDraftInput,
	TranslationEditorView,
	TranslationRecord
} from './posts.interfaces';
import { findPost, findTranslation, postSubject } from './posts';
import {
	insertRevision,
	latestSnapshotId,
	pruneRevisions,
	readRevisionPayload,
	samePayload,
	writeRevision
} from './revision-store';
import type { RevisionPayload, TranslationPointers } from './revision-store.interfaces';
import { parseTagInput } from './tags';

export function loadTranslationEditor(
	runtime: Runtime,
	actor: AuthUser,
	translation: TranslationRecord
): TranslationEditorView {
	const workingRevisionId = runtime.db.transaction((tx) =>
		ensureWorkingRevision(tx, translation, actor.id)
	);
	const payload = readRevisionPayload(runtime.db, workingRevisionId);
	const working = runtime.db
		.select({ updatedAt: postRevisions.updatedAt })
		.from(postRevisions)
		.where(eq(postRevisions.id, workingRevisionId))
		.get();

	if (payload === null || working === undefined) {
		throw new Error('The working draft could not be loaded');
	}

	return {
		id: translation.id,
		languageCode: translation.languageCode,
		status: translation.status,
		liveSlug: translation.slug,
		hasPendingChanges: translation.pendingRevisionId !== null,
		draft: {
			title: payload.title,
			slug: payload.slug,
			excerpt: payload.excerpt,
			metaTitle: payload.metaTitle ?? '',
			metaDescription: payload.metaDescription ?? '',
			ogMediaId: payload.ogMediaId,
			tags: payload.tags,
			content: payload.contentJson,
			readingTimeMinutes: payload.readingTimeMinutes,
			version: working.updatedAt.getTime(),
			updatedAt: working.updatedAt
		}
	};
}

export function saveTranslationDraft(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	languageCode: string,
	input: TranslationDraftInput,
	mode: DraftSaveMode
): DraftSaveResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return { status: 'not_found' };
	}

	requirePermission(actor, 'post.edit', postSubject(post));

	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null) {
		return { status: 'not_found' };
	}

	const tags = parseTagInput(input.tags);

	if (tags.status !== 'ok') {
		return { status: tags.status };
	}

	const rendered = renderContent(input.content);

	if (rendered.status === 'invalid') {
		return { status: 'invalid_content' };
	}

	if (rendered.status === 'too_large') {
		return { status: 'content_too_large' };
	}

	const title = input.title.trim();

	if (mode === 'save' && title === '') {
		return { status: 'title_required' };
	}

	if (unusableMediaIds(runtime.db, actor, referencedMedia(rendered.content, input)).length > 0) {
		return { status: 'invalid_media' };
	}

	const retention = loadSystemSettings(runtime.db).revisionRetention;

	return runtime.db.transaction((tx): DraftSaveResult => {
		const workingRevisionId = ensureWorkingRevision(tx, translation, actor.id);

		if (revisionVersion(tx, workingRevisionId) !== input.version) {
			return { status: 'conflict' };
		}

		const slug = resolvePostSlug(tx, {
			translationId: translation.id,
			languageCode,
			requested: input.slug,
			title,
			generate: mode === 'save'
		});

		if (slug.status !== 'ok') {
			return { status: slug.status };
		}

		const payload: RevisionPayload = {
			title,
			slug: slug.slug,
			excerpt: input.excerpt.trim(),
			metaTitle: input.metaTitle,
			metaDescription: input.metaDescription,
			ogMediaId: input.ogMediaId,
			contentJson: rendered.content.json,
			contentHtml: rendered.content.html,
			contentText: rendered.content.text,
			readingTimeMinutes: rendered.content.readingTimeMinutes,
			tags: tags.names,
			mediaIds: rendered.content.mediaIds
		};
		const now = new Date();
		const pointers: TranslationPointers = { ...translation, workingRevisionId };
		let snapshotId: string | null = null;

		writeRevision(tx, workingRevisionId, languageCode, actor.id, payload);

		if (mode === 'save') {
			snapshotId = snapshot(tx, pointers, languageCode, actor.id, payload);
			pruneRevisions(tx, pointers, retention);
		}

		tx.update(postTranslations)
			.set({ updatedAt: now })
			.where(eq(postTranslations.id, translation.id))
			.run();
		tx.update(posts).set({ updatedAt: now }).where(eq(posts.id, postId)).run();

		const version = revisionVersion(tx, workingRevisionId);

		return {
			status: 'saved',
			version,
			slug: payload.slug,
			readingTimeMinutes: payload.readingTimeMinutes,
			savedAt: new Date(version),
			snapshotId
		};
	});
}

export function ensureWorkingRevision(
	tx: DatabaseExecutor,
	translation: TranslationRecord,
	authorId: string
): string {
	const current = tx
		.select({ workingRevisionId: postTranslations.workingRevisionId })
		.from(postTranslations)
		.where(eq(postTranslations.id, translation.id))
		.get();

	if (current?.workingRevisionId) {
		return current.workingRevisionId;
	}

	const pointers: TranslationPointers = { ...translation, workingRevisionId: null };
	const latest = latestSnapshotId(tx, pointers);
	let payload: RevisionPayload | null = null;

	if (latest !== null) {
		payload = readRevisionPayload(tx, latest);
	}

	const revisionId = insertRevision(
		tx,
		translation.id,
		translation.languageCode,
		authorId,
		payload ?? emptyPayload()
	);

	tx.update(postTranslations)
		.set({ workingRevisionId: revisionId })
		.where(eq(postTranslations.id, translation.id))
		.run();

	return revisionId;
}

function snapshot(
	tx: DatabaseExecutor,
	pointers: TranslationPointers,
	languageCode: string,
	authorId: string,
	payload: RevisionPayload
): string {
	const latest = latestSnapshotId(tx, pointers);

	if (latest !== null) {
		const previous = readRevisionPayload(tx, latest);

		if (previous !== null && samePayload(previous, payload)) {
			return latest;
		}
	}

	return insertRevision(tx, pointers.id, languageCode, authorId, payload);
}

function revisionVersion(tx: DatabaseExecutor, revisionId: string): number {
	const row = tx
		.select({ updatedAt: postRevisions.updatedAt })
		.from(postRevisions)
		.where(eq(postRevisions.id, revisionId))
		.get();

	if (row === undefined) {
		throw new Error('The working draft is missing');
	}

	return row.updatedAt.getTime();
}

function referencedMedia(content: RenderedContent, input: TranslationDraftInput): string[] {
	if (input.ogMediaId === null) {
		return content.mediaIds;
	}

	return [...content.mediaIds, input.ogMediaId];
}

function emptyPayload(): RevisionPayload {
	const rendered = renderContentDocument(emptyContentDocument());

	if (rendered.status !== 'rendered') {
		throw new Error('The empty content document could not be rendered');
	}

	return {
		title: '',
		slug: '',
		excerpt: '',
		metaTitle: null,
		metaDescription: null,
		ogMediaId: null,
		contentJson: rendered.content.json,
		contentHtml: rendered.content.html,
		contentText: rendered.content.text,
		readingTimeMinutes: rendered.content.readingTimeMinutes,
		tags: [],
		mediaIds: []
	};
}
