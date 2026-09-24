import { describe, expect, it } from 'vitest';
import { isMediaId, mediaSrcset, mediaUrl, parseMediaUrl, variantDimensions } from './media-urls';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('responsive images', () => {
	it('lists each responsive variant with its real width', () => {
		expect(mediaSrcset(ID, 3000)).toBe(
			`/media/${ID}/480.webp 480w, /media/${ID}/960.webp 960w, /media/${ID}/1600.webp 1600w`
		);
		expect(mediaSrcset(ID, 800)).toBe(`/media/${ID}/480.webp 480w, /media/${ID}/960.webp 800w`);
		expect(mediaSrcset(ID, 300)).toBe(`/media/${ID}/480.webp 300w`);
	});

	it('scales dimensions down to a variant without enlarging', () => {
		expect(variantDimensions(3200, 1800, '1600')).toEqual({ width: 1600, height: 900 });
		expect(variantDimensions(800, 600, '1600')).toEqual({ width: 800, height: 600 });
	});
});

describe('media URLs', () => {
	it('builds and parses media URLs', () => {
		expect(mediaUrl(ID, '960')).toBe(`/media/${ID}/960.webp`);
		expect(parseMediaUrl(`/media/${ID}/full.webp`)).toEqual({ id: ID, variant: 'full' });
	});

	it.each([
		`https://cms.example.com/media/${ID}/960.webp`,
		`/media/${ID}/961.webp`,
		`/media/${ID}/960.png`,
		`/media/${ID.toUpperCase()}/960.webp`,
		`/media/../${ID}/960.webp`,
		`/media/${ID}/960.webp?x=1`,
		'/media/not-a-uuid/960.webp',
		'data:image/png;base64,AAAA'
	])('rejects %s', (src) => {
		expect(parseMediaUrl(src)).toBeNull();
	});

	it('only accepts lowercase version 4 UUIDs as media ids', () => {
		expect(isMediaId(ID)).toBe(true);
		expect(isMediaId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(false);
		expect(isMediaId('../etc/passwd')).toBe(false);
	});
});
