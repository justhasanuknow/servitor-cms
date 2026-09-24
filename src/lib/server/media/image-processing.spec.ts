import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { animatedGif, jpegWithExif, pngImage, withPngDimensions } from '../testing/images';
import { processImage } from './image-processing';
import type { ProcessedImage } from './image-processing.interfaces';

async function processed(
	input: Buffer,
	format: 'jpeg' | 'png' | 'gif',
	square = false
): Promise<ProcessedImage> {
	const result = await processImage(input, format, { square });

	if (result.status !== 'processed') {
		throw new Error(`Expected the image to be processed, got ${result.status}`);
	}

	return result.image;
}

describe('processImage', () => {
	it('creates WebP variants at 480, 960, 1600 and a full size capped at 2560', async () => {
		const image = await processed(await jpegWithExif(3000, 2000), 'jpeg');

		expect(image.variants.map((entry) => [entry.variant, entry.width])).toEqual([
			['480', 480],
			['960', 960],
			['1600', 1600],
			['full', 2560]
		]);

		for (const entry of image.variants) {
			expect((await sharp(entry.data).metadata()).format).toBe('webp');
		}

		expect(image.width).toBe(2560);
		expect(image.height).toBe(1707);
	});

	it('never enlarges small images', async () => {
		const image = await processed(await pngImage(300, 200), 'png');

		expect(image.variants.every((entry) => entry.width === 300 && entry.height === 200)).toBe(
			true
		);
	});

	it('strips EXIF and other metadata', async () => {
		const image = await processed(await jpegWithExif(800, 600), 'jpeg');

		for (const entry of image.variants) {
			const metadata = await sharp(entry.data).metadata();

			expect(metadata.exif).toBeUndefined();
			expect(metadata.xmp).toBeUndefined();
			expect(metadata.iptc).toBeUndefined();
		}
	});

	it('turns animated GIFs into animated WebP images', async () => {
		const image = await processed(await animatedGif(), 'gif');
		const metadata = await sharp(image.variants[0].data).metadata();

		expect(image.animated).toBe(true);
		expect(metadata.format).toBe('webp');
		expect(metadata.pages).toBe(3);
		expect(image.width).toBe(64);
		expect(image.height).toBe(48);
	});

	it('crops avatars to squares', async () => {
		const image = await processed(await jpegWithExif(1200, 800), 'jpeg', true);

		expect(image.variants.map((entry) => [entry.width, entry.height])).toEqual([
			[480, 480],
			[800, 800],
			[800, 800],
			[800, 800]
		]);
	});

	it('rejects images whose content does not match the detected format', async () => {
		const result = await processImage(await pngImage(20, 20), 'jpeg', { square: false });

		expect(result.status).toBe('invalid_image');
	});

	it('rejects corrupted image data', async () => {
		const corrupted = Buffer.concat([
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			Buffer.from('garbage')
		]);
		const result = await processImage(corrupted, 'png', { square: false });

		expect(result.status).toBe('invalid_image');
	});

	it('rejects images above the 40 megapixel limit', async () => {
		const huge = withPngDimensions(await pngImage(1, 1), 8000, 6000);
		const result = await processImage(huge, 'png', { square: false });

		expect(result.status).toBe('too_many_pixels');
	});
});
