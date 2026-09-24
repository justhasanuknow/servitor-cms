import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth';
import type { AppDatabase } from '../db';
import { userProfiles } from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import { discardMedia, uploadMedia } from './media-library';
import type { MediaUploadResult } from './media-library.interfaces';

export async function replaceAvatar(
	runtime: Runtime,
	actor: AuthUser,
	file: File
): Promise<MediaUploadResult> {
	requirePermission(actor, 'account.manage', null);

	const upload = await uploadMedia(runtime, actor, file, 'avatar');

	if (upload.status !== 'uploaded') {
		return upload;
	}

	const previous = setAvatar(runtime.db, actor.id, upload.id);

	if (previous !== null) {
		await discardMedia(runtime, previous);
	}

	return upload;
}

export async function removeAvatar(runtime: Runtime, actor: AuthUser): Promise<void> {
	requirePermission(actor, 'account.manage', null);

	const previous = setAvatar(runtime.db, actor.id, null);

	if (previous !== null) {
		await discardMedia(runtime, previous);
	}
}

export function avatarMediaId(db: AppDatabase, userId: string): string | null {
	const row = db
		.select({ avatarMediaId: userProfiles.avatarMediaId })
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.get();

	return row?.avatarMediaId ?? null;
}

function setAvatar(db: AppDatabase, userId: string, mediaId: string | null): string | null {
	const now = new Date();

	return db.transaction((tx) => {
		const current = tx
			.select({ avatarMediaId: userProfiles.avatarMediaId })
			.from(userProfiles)
			.where(eq(userProfiles.userId, userId))
			.get();

		tx.insert(userProfiles)
			.values({ userId, avatarMediaId: mediaId, updatedAt: now })
			.onConflictDoUpdate({
				target: userProfiles.userId,
				set: { avatarMediaId: mediaId, updatedAt: now }
			})
			.run();

		return current?.avatarMediaId ?? null;
	});
}
