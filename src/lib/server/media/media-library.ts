import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { MAX_MEDIA_UPLOAD_BYTES, type MediaKind } from '../../constants/media';
import type { AuthUser } from '../auth/auth';
import type { AppDatabase, DatabaseExecutor } from '../db';
import {
	contentLanguages,
	media,
	mediaAltTexts,
	postRevisionMedia,
	postRevisions,
	posts,
	userProfiles
} from '../db/schema';
import { can, requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import { RATE_LIMIT_RULES } from '../security/rate-limiter';
import { reportSecurityEvent } from '../security/security-events';
import { detectImageFormat } from './image-format';
import { processImage } from './image-processing';
import type {
	MediaAltTextInput,
	MediaAltTextResult,
	MediaDeleteResult,
	MediaItemView,
	MediaPage,
	MediaRecord,
	MediaUploadResult
} from './media-library.interfaces';

export const MEDIA_PAGE_SIZE = 48;

export async function uploadMedia(
	runtime: Runtime,
	actor: AuthUser,
	file: File,
	kind: MediaKind
): Promise<MediaUploadResult> {
	requirePermission(actor, 'media.upload', null);

	if (
		!runtime.rateLimiter.consume(`media-upload:user:${actor.id}`, RATE_LIMIT_RULES.mediaUpload)
			.allowed
	) {
		reportSecurityEvent({ type: 'rate_limited', limit: 'media_upload', userId: actor.id });

		return { status: 'rate_limited' };
	}

	if (file.size === 0) {
		return { status: 'empty' };
	}

	if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
		return { status: 'too_large' };
	}

	const input = Buffer.from(await file.arrayBuffer());
	const format = detectImageFormat(input);

	if (format === null) {
		return { status: 'unsupported_type' };
	}

	const processed = await processImage(input, format, { square: kind === 'avatar' });

	if (processed.status !== 'processed') {
		return { status: processed.status };
	}

	const id = crypto.randomUUID();

	await runtime.media.save(id, processed.image.variants);

	try {
		runtime.db
			.insert(media)
			.values({
				id,
				ownerId: actor.id,
				kind,
				sourceFormat: format,
				animated: processed.image.animated,
				width: processed.image.width,
				height: processed.image.height,
				byteSize: processed.image.byteSize
			})
			.run();
	} catch (error) {
		await runtime.media.remove(id);

		throw error;
	}

	return { status: 'uploaded', id };
}

export function findMedia(db: DatabaseExecutor, id: string): MediaRecord | null {
	const row = db
		.select({
			id: media.id,
			ownerId: media.ownerId,
			kind: media.kind,
			width: media.width,
			height: media.height
		})
		.from(media)
		.where(eq(media.id, id))
		.get();

	return row ?? null;
}

export function mediaExists(db: AppDatabase, id: string): boolean {
	return findMedia(db, id) !== null;
}

export function listOwnMedia(db: AppDatabase, ownerId: string, requestedPage: number): MediaPage {
	const filter = and(eq(media.ownerId, ownerId), eq(media.kind, 'library'));
	const total = db.select({ total: count() }).from(media).where(filter).get()?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));
	const page = Math.min(Math.max(1, requestedPage), pageCount);
	const rows = db
		.select()
		.from(media)
		.where(filter)
		.orderBy(desc(media.createdAt), desc(media.id))
		.limit(MEDIA_PAGE_SIZE)
		.offset((page - 1) * MEDIA_PAGE_SIZE)
		.all();
	const ids = rows.map((row) => row.id);
	const altTexts = altTextsOf(db, ids);
	const used = mediaInUse(db, ids);
	const items: MediaItemView[] = rows.map((row) => ({
		id: row.id,
		width: row.width,
		height: row.height,
		animated: row.animated,
		byteSize: row.byteSize,
		createdAt: row.createdAt,
		altTexts: altTexts.get(row.id) ?? {},
		inUse: used.has(row.id)
	}));

	return { items, page, pageCount, total };
}

export function updateMediaAltTexts(
	runtime: Runtime,
	actor: AuthUser,
	id: string,
	entries: MediaAltTextInput[]
): MediaAltTextResult {
	const record = findMedia(runtime.db, id);

	if (record === null || record.kind !== 'library') {
		return 'not_found';
	}

	requirePermission(actor, 'media.edit', { ownerId: record.ownerId });

	const known = new Set(
		runtime.db
			.select({ code: contentLanguages.code })
			.from(contentLanguages)
			.all()
			.map((row) => row.code)
	);

	if (entries.some((entry) => !known.has(entry.languageCode))) {
		return 'unknown_language';
	}

	const now = new Date();

	runtime.db.transaction((tx) => {
		for (const entry of entries) {
			const altText = entry.altText.trim();
			const key = and(
				eq(mediaAltTexts.mediaId, id),
				eq(mediaAltTexts.languageCode, entry.languageCode)
			);

			if (altText === '') {
				tx.delete(mediaAltTexts).where(key).run();
			} else {
				tx.insert(mediaAltTexts)
					.values({
						mediaId: id,
						languageCode: entry.languageCode,
						altText,
						updatedAt: now
					})
					.onConflictDoUpdate({
						target: [mediaAltTexts.mediaId, mediaAltTexts.languageCode],
						set: { altText, updatedAt: now }
					})
					.run();
			}
		}
	});

	return 'saved';
}

export async function deleteMedia(
	runtime: Runtime,
	actor: AuthUser,
	id: string
): Promise<MediaDeleteResult> {
	const record = findMedia(runtime.db, id);

	if (record === null || record.kind !== 'library') {
		return 'not_found';
	}

	requirePermission(actor, 'media.delete', { ownerId: record.ownerId });

	const deleted = runtime.db.transaction((tx) => {
		if (mediaInUse(tx, [id]).has(id)) {
			return false;
		}

		tx.delete(media).where(eq(media.id, id)).run();

		return true;
	});

	if (!deleted) {
		return 'in_use';
	}

	await runtime.media.remove(id);

	return 'deleted';
}

export async function discardMedia(runtime: Runtime, id: string): Promise<void> {
	runtime.db.delete(media).where(eq(media.id, id)).run();
	await runtime.media.remove(id);
}

export function unusableMediaIds(db: DatabaseExecutor, actor: AuthUser, ids: string[]): string[] {
	if (ids.length === 0) {
		return [];
	}

	const found = new Map(
		db
			.select({ id: media.id, ownerId: media.ownerId, kind: media.kind })
			.from(media)
			.where(inArray(media.id, ids))
			.all()
			.map((row) => [row.id, row])
	);

	return ids.filter((id) => {
		const row = found.get(id);

		return (
			row === undefined ||
			row.kind !== 'library' ||
			!can(actor, 'media.use', { ownerId: row.ownerId })
		);
	});
}

export function altTextsOf(
	db: DatabaseExecutor,
	ids: string[]
): Map<string, Record<string, string>> {
	const result = new Map<string, Record<string, string>>();

	if (ids.length === 0) {
		return result;
	}

	for (const row of db
		.select()
		.from(mediaAltTexts)
		.where(inArray(mediaAltTexts.mediaId, ids))
		.all()) {
		const entries = result.get(row.mediaId) ?? {};

		entries[row.languageCode] = row.altText;
		result.set(row.mediaId, entries);
	}

	return result;
}

export function mediaInUse(db: DatabaseExecutor, ids: string[]): Set<string> {
	const used = new Set<string>();

	if (ids.length === 0) {
		return used;
	}

	const references = [
		db
			.select({ id: postRevisionMedia.mediaId })
			.from(postRevisionMedia)
			.where(inArray(postRevisionMedia.mediaId, ids))
			.all(),
		db
			.select({ id: postRevisions.ogMediaId })
			.from(postRevisions)
			.where(and(isNotNull(postRevisions.ogMediaId), inArray(postRevisions.ogMediaId, ids)))
			.all(),
		db
			.select({ id: posts.coverMediaId })
			.from(posts)
			.where(and(isNotNull(posts.coverMediaId), inArray(posts.coverMediaId, ids)))
			.all(),
		db
			.select({ id: userProfiles.avatarMediaId })
			.from(userProfiles)
			.where(
				and(isNotNull(userProfiles.avatarMediaId), inArray(userProfiles.avatarMediaId, ids))
			)
			.all()
	];

	for (const rows of references) {
		for (const row of rows) {
			if (row.id !== null) {
				used.add(row.id);
			}
		}
	}

	return used;
}
