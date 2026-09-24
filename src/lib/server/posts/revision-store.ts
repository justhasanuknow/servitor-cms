import { and, desc, eq, inArray, max, ne } from 'drizzle-orm';
import type { DatabaseExecutor } from '../db';
import { postRevisionMedia, postRevisions } from '../db/schema';
import type { RevisionPayload, TranslationPointers } from './revision-store.interfaces';
import { attachTags, tagNamesOf } from './tags';

export function insertRevision(
	tx: DatabaseExecutor,
	translationId: string,
	languageCode: string,
	authorId: string,
	payload: RevisionPayload
): string {
	const id = crypto.randomUUID();
	const createdAt = nextRevisionTime(tx, translationId);

	tx.insert(postRevisions)
		.values({
			id,
			translationId,
			authorId,
			...revisionColumns(payload),
			createdAt,
			updatedAt: createdAt
		})
		.run();
	attachRelations(tx, id, languageCode, payload);

	return id;
}

export function writeRevision(
	tx: DatabaseExecutor,
	revisionId: string,
	languageCode: string,
	authorId: string,
	payload: RevisionPayload
): void {
	tx.update(postRevisions)
		.set({ authorId, ...revisionColumns(payload), updatedAt: new Date() })
		.where(eq(postRevisions.id, revisionId))
		.run();
	attachRelations(tx, revisionId, languageCode, payload);
}

export function readRevisionPayload(
	tx: DatabaseExecutor,
	revisionId: string
): RevisionPayload | null {
	const row = tx.select().from(postRevisions).where(eq(postRevisions.id, revisionId)).get();

	if (row === undefined) {
		return null;
	}

	const mediaIds = tx
		.select({ mediaId: postRevisionMedia.mediaId })
		.from(postRevisionMedia)
		.where(eq(postRevisionMedia.revisionId, revisionId))
		.all()
		.map((entry) => entry.mediaId);

	return {
		title: row.title,
		slug: row.slug,
		excerpt: row.excerpt,
		metaTitle: row.metaTitle,
		metaDescription: row.metaDescription,
		ogMediaId: row.ogMediaId,
		contentJson: row.contentJson,
		contentHtml: row.contentHtml,
		contentText: row.contentText,
		readingTimeMinutes: row.readingTimeMinutes,
		tags: tagNamesOf(tx, [revisionId]).get(revisionId) ?? [],
		mediaIds
	};
}

export function samePayload(first: RevisionPayload, second: RevisionPayload): boolean {
	return (
		first.title === second.title &&
		first.slug === second.slug &&
		first.excerpt === second.excerpt &&
		first.metaTitle === second.metaTitle &&
		first.metaDescription === second.metaDescription &&
		first.ogMediaId === second.ogMediaId &&
		first.contentJson === second.contentJson &&
		sameNames(first.tags, second.tags)
	);
}

export function latestSnapshotId(
	tx: DatabaseExecutor,
	translation: TranslationPointers
): string | null {
	const row = tx
		.select({ id: postRevisions.id })
		.from(postRevisions)
		.where(historyFilter(translation))
		.orderBy(desc(postRevisions.createdAt), desc(postRevisions.id))
		.get();

	return row?.id ?? null;
}

export function pruneRevisions(
	tx: DatabaseExecutor,
	translation: TranslationPointers,
	keep: number
): void {
	const protectedIds = new Set(
		[translation.pendingRevisionId, translation.liveRevisionId].filter(
			(id): id is string => id !== null
		)
	);
	const history = tx
		.select({ id: postRevisions.id })
		.from(postRevisions)
		.where(historyFilter(translation))
		.orderBy(desc(postRevisions.createdAt), desc(postRevisions.id))
		.all();
	const expired = history
		.slice(keep)
		.map((row) => row.id)
		.filter((id) => !protectedIds.has(id));

	if (expired.length > 0) {
		tx.delete(postRevisions).where(inArray(postRevisions.id, expired)).run();
	}
}

export function historyFilter(translation: TranslationPointers) {
	if (translation.workingRevisionId === null) {
		return eq(postRevisions.translationId, translation.id);
	}

	return and(
		eq(postRevisions.translationId, translation.id),
		ne(postRevisions.id, translation.workingRevisionId)
	);
}

function nextRevisionTime(tx: DatabaseExecutor, translationId: string): Date {
	const latest = tx
		.select({ value: max(postRevisions.createdAt) })
		.from(postRevisions)
		.where(eq(postRevisions.translationId, translationId))
		.get()?.value;
	const now = Date.now();

	if (latest === null || latest === undefined || latest.getTime() < now) {
		return new Date(now);
	}

	return new Date(latest.getTime() + 1);
}

function revisionColumns(payload: RevisionPayload) {
	return {
		title: payload.title,
		slug: payload.slug,
		excerpt: payload.excerpt,
		metaTitle: payload.metaTitle,
		metaDescription: payload.metaDescription,
		ogMediaId: payload.ogMediaId,
		contentJson: payload.contentJson,
		contentHtml: payload.contentHtml,
		contentText: payload.contentText,
		readingTimeMinutes: payload.readingTimeMinutes
	};
}

function attachRelations(
	tx: DatabaseExecutor,
	revisionId: string,
	languageCode: string,
	payload: RevisionPayload
): void {
	attachTags(tx, revisionId, languageCode, payload.tags);
	tx.delete(postRevisionMedia).where(eq(postRevisionMedia.revisionId, revisionId)).run();

	if (payload.mediaIds.length > 0) {
		tx.insert(postRevisionMedia)
			.values(payload.mediaIds.map((mediaId) => ({ revisionId, mediaId })))
			.run();
	}
}

function sameNames(first: string[], second: string[]): boolean {
	const left = [...first].sort();
	const right = [...second].sort();

	return left.length === right.length && left.every((name, index) => name === right[index]);
}
