import { describe, expect, it } from 'vitest';
import {
	animatedGif,
	avifImage,
	jpegWithExif,
	pngImage,
	SVG_IMAGE,
	webpImage
} from '../testing/images';
import { detectImageFormat } from './image-format';

function bytes(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

describe('detectImageFormat', () => {
	it('detects every accepted format from its magic bytes', async () => {
		expect(detectImageFormat(await jpegWithExif(16, 16))).toBe('jpeg');
		expect(detectImageFormat(await pngImage(16, 16))).toBe('png');
		expect(detectImageFormat(await webpImage(16, 16))).toBe('webp');
		expect(detectImageFormat(await animatedGif())).toBe('gif');
		expect(detectImageFormat(await avifImage(16, 16))).toBe('avif');
	});

	it.each([
		['SVG', SVG_IMAGE],
		['HTML', bytes('<!doctype html><script>alert(1)</script>')],
		['plain text', bytes('just some text')],
		['an empty file', new Uint8Array()],
		['a truncated PNG signature', new Uint8Array([0x89, 0x50, 0x4e])],
		['a RIFF audio file', bytes('RIFF\u0000\u0000\u0000\u0000WAVEfmt ')],
		[
			'an MP4 video',
			new Uint8Array([0, 0, 0, 24, ...bytes('ftypmp42'), 0, 0, 0, 0, ...bytes('mp42isom')])
		],
		['an oversized ftyp box', new Uint8Array([0, 0, 1, 0, ...bytes('ftypavif'), 0, 0, 0, 0])]
	])('rejects %s', (name, data) => {
		expect(detectImageFormat(data)).toBeNull();
	});
});
