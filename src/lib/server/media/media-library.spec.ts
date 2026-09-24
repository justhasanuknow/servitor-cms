import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_MEDIA_UPLOAD_BYTES, MEDIA_VARIANTS } from '../../constants/media';
import type { AuthUser } from '../auth/auth';
import { media, postRevisionMedia, postRevisions, postTranslations, posts } from '../db/schema';
import { ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import { animatedGif, imageFile, jpegWithExif, pngImage, SVG_IMAGE } from '../testing/images';
import { createTestRuntime } from '../testing/runtime';
import { avatarMediaId, removeAvatar, replaceAvatar } from './avatars';
import {
	deleteMedia,
	listOwnMedia,
	unusableMediaIds,
	updateMediaAltTexts,
	uploadMedia
} from './media-library';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

let owner: AuthUser;

let other: AuthUser;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'owner@example.com', password: PASSWORD });
	await harness.createUser({ email: 'other@example.com', password: PASSWORD, role: 'admin' });
	owner = (await harness.signIn('owner@example.com', PASSWORD)).actor;
	other = (await harness.signIn('other@example.com', PASSWORD)).actor;
});

afterEach(() => {
	harness.dispose();
});

async function upload(actor: AuthUser, data?: Buffer): Promise<string> {
	const file = imageFile(data ?? (await jpegWithExif(640, 480)), 'photo.jpg', 'image/jpeg');
	const result = await uploadMedia(harness.runtime, actor, file, 'library');

	if (result.status !== 'uploaded') {
		throw new Error(`Expected the upload to succeed, got ${result.status}`);
	}

	return result.id;
}

function variantPath(id: string, variant: string): string {
	return join(harness.runtime.media.root, id, `${variant}.webp`);
}

function referenceFromRevision(mediaId: string, field: 'content' | 'og' | 'cover'): void {
	const db = harness.runtime.db;
	const postId = crypto.randomUUID();
	const translationId = crypto.randomUUID();
	const revisionId = crypto.randomUUID();
	let coverMediaId: string | null = null;
	let ogMediaId: string | null = null;

	if (field === 'cover') {
		coverMediaId = mediaId;
	}

	if (field === 'og') {
		ogMediaId = mediaId;
	}

	db.insert(posts).values({ id: postId, ownerId: owner.id, coverMediaId }).run();
	db.insert(postTranslations).values({ id: translationId, postId, languageCode: 'en' }).run();
	db.insert(postRevisions)
		.values({
			id: revisionId,
			translationId,
			authorId: owner.id,
			title: 'Post',
			slug: 'post',
			ogMediaId,
			contentJson: '{"type":"doc","content":[{"type":"paragraph"}]}',
			contentHtml: '<p></p>',
			contentText: '',
			readingTimeMinutes: 0
		})
		.run();

	if (field === 'content') {
		db.insert(postRevisionMedia).values({ revisionId, mediaId }).run();
	}
}

describe('uploadMedia', () => {
	it('stores every WebP variant under a random id and records the image', async () => {
		const id = await upload(owner);
		const row = harness.runtime.db.select().from(media).all()[0];

		expect(row).toMatchObject({
			id,
			ownerId: owner.id,
			kind: 'library',
			sourceFormat: 'jpeg',
			animated: false,
			width: 640,
			height: 480
		});

		for (const variant of MEDIA_VARIANTS) {
			expect(existsSync(variantPath(id, variant))).toBe(true);
		}

		const stored = await harness.runtime.media.read(id, '480');

		expect(stored).not.toBeNull();
		expect((await sharp(stored ?? Buffer.alloc(0)).metadata()).exif).toBeUndefined();
	});

	it('records animated GIFs as animated media', async () => {
		const id = await upload(owner, await animatedGif());
		const row = harness.runtime.db.select().from(media).all()[0];

		expect(row).toMatchObject({ id, sourceFormat: 'gif', animated: true });
	});

	it('detects the type from the content instead of the name or MIME type', async () => {
		const disguisedSvg = imageFile(SVG_IMAGE, 'photo.png', 'image/png');
		const disguisedText = imageFile(Buffer.from('hello'), 'photo.jpg', 'image/jpeg');
		const pngNamedGif = imageFile(await pngImage(40, 40), 'photo.gif', 'image/gif');

		expect(await uploadMedia(harness.runtime, owner, disguisedSvg, 'library')).toEqual({
			status: 'unsupported_type'
		});
		expect(await uploadMedia(harness.runtime, owner, disguisedText, 'library')).toEqual({
			status: 'unsupported_type'
		});
		expect((await uploadMedia(harness.runtime, owner, pngNamedGif, 'library')).status).toBe(
			'uploaded'
		);
		expect(harness.runtime.db.select().from(media).all()[0]?.sourceFormat).toBe('png');
	});

	it('rejects empty and oversized files before processing them', async () => {
		const empty = imageFile(Buffer.alloc(0), 'empty.png', 'image/png');
		const oversized = imageFile(
			Buffer.alloc(MAX_MEDIA_UPLOAD_BYTES + 1),
			'big.png',
			'image/png'
		);

		expect(await uploadMedia(harness.runtime, owner, empty, 'library')).toEqual({
			status: 'empty'
		});
		expect(await uploadMedia(harness.runtime, owner, oversized, 'library')).toEqual({
			status: 'too_large'
		});
		expect(harness.runtime.db.select().from(media).all()).toEqual([]);
	});
});

describe('the media library', () => {
	it('lists only the own library media with alt texts and usage', async () => {
		const own = await upload(owner);

		await upload(other);
		updateMediaAltTexts(harness.runtime, owner, own, [
			{ languageCode: 'en', altText: 'A lake' }
		]);

		const page = listOwnMedia(harness.runtime.db, owner.id, 1);

		expect(page.total).toBe(1);
		expect(page.items.map((item) => [item.id, item.altTexts, item.inUse])).toEqual([
			[own, { en: 'A lake' }, false]
		]);
	});

	it('lets only the owner change alt texts in known languages', async () => {
		const id = await upload(owner);

		expect(
			updateMediaAltTexts(harness.runtime, owner, id, [{ languageCode: 'xx', altText: 'x' }])
		).toBe('unknown_language');
		expect(() =>
			updateMediaAltTexts(harness.runtime, other, id, [{ languageCode: 'en', altText: 'x' }])
		).toThrow(expect.objectContaining({ status: 403 }));

		updateMediaAltTexts(harness.runtime, owner, id, [{ languageCode: 'en', altText: 'Lake' }]);
		updateMediaAltTexts(harness.runtime, owner, id, [{ languageCode: 'en', altText: '  ' }]);

		expect(listOwnMedia(harness.runtime.db, owner.id, 1).items[0].altTexts).toEqual({});
	});

	it.each(['content', 'og', 'cover'] as const)(
		'blocks deleting media used as %s',
		async (field) => {
			const id = await upload(owner);

			referenceFromRevision(id, field);

			expect(await deleteMedia(harness.runtime, owner, id)).toBe('in_use');
			expect(existsSync(variantPath(id, 'full'))).toBe(true);
			expect(listOwnMedia(harness.runtime.db, owner.id, 1).items[0].inUse).toBe(true);
		}
	);

	it('deletes unused own media and its files', async () => {
		const id = await upload(owner);

		expect(await deleteMedia(harness.runtime, owner, id)).toBe('deleted');
		expect(existsSync(join(harness.runtime.media.root, id))).toBe(false);
		expect(harness.runtime.db.select().from(media).all()).toEqual([]);
		expect(await deleteMedia(harness.runtime, owner, id)).toBe('not_found');
	});

	it("refuses to delete another user's media", async () => {
		const id = await upload(owner);

		await expect(deleteMedia(harness.runtime, other, id)).rejects.toMatchObject({
			status: 403
		});
		expect(existsSync(variantPath(id, 'full'))).toBe(true);
	});

	it('only lets users insert their own library media', async () => {
		const own = await upload(owner);
		const foreign = await upload(other);
		const missing = crypto.randomUUID();

		expect(unusableMediaIds(harness.runtime.db, owner, [own, foreign, missing])).toEqual([
			foreign,
			missing
		]);
	});
});

describe('avatars', () => {
	it('stores square avatars and replaces the previous one', async () => {
		const first = await replaceAvatar(
			harness.runtime,
			owner,
			imageFile(await jpegWithExif(900, 600), 'me.jpg', 'image/jpeg')
		);

		if (first.status !== 'uploaded') {
			throw new Error('Expected the avatar upload to succeed');
		}

		expect(avatarMediaId(harness.runtime.db, owner.id)).toBe(first.id);
		expect(harness.runtime.db.select().from(media).all()[0]).toMatchObject({
			kind: 'avatar',
			width: 600,
			height: 600
		});
		expect(listOwnMedia(harness.runtime.db, owner.id, 1).total).toBe(0);
		expect(unusableMediaIds(harness.runtime.db, owner, [first.id])).toEqual([first.id]);

		const second = await replaceAvatar(
			harness.runtime,
			owner,
			imageFile(await pngImage(300, 300), 'me.png', 'image/png')
		);

		if (second.status !== 'uploaded') {
			throw new Error('Expected the avatar upload to succeed');
		}

		expect(existsSync(join(harness.runtime.media.root, first.id))).toBe(false);
		expect(
			harness.runtime.db
				.select()
				.from(media)
				.all()
				.map((row) => row.id)
		).toEqual([second.id]);

		await removeAvatar(harness.runtime, owner);

		expect(avatarMediaId(harness.runtime.db, owner.id)).toBeNull();
		expect(harness.runtime.db.select().from(media).all()).toEqual([]);
	});
});
