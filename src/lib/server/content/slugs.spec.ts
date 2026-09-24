import { describe, expect, it } from 'vitest';
import {
	isValidSlug,
	MAX_SLUG_LENGTH,
	shortSlugId,
	slugFromText,
	slugOrShortId,
	withNumericSuffix
} from './slugs';

describe('slugFromText', () => {
	it.each([
		['Merhaba Dünya', 'tr', 'merhaba-dunya'],
		['Größe und Maße', 'de', 'groesse-und-masse'],
		['Crème brûlée', 'fr', 'creme-brulee'],
		['Привет мир', 'ru', 'privet-mir'],
		['  Hello,   World!  ', 'en', 'hello-world'],
		['CamelCase Title', 'en', 'camelcase-title']
	])('turns %s (%s) into %s', (text, language, expected) => {
		expect(slugFromText(text, language)).toBe(expected);
	});

	it('returns an empty slug for scripts without a transliteration', () => {
		expect(slugFromText('こんにちは世界', 'ja')).toBe('');
		expect(slugFromText('你好世界', 'zh-Hans')).toBe('');
	});

	it('keeps slugs within the length limit without a trailing dash', () => {
		const slug = slugFromText(`${'word '.repeat(60)}`, 'en');

		expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
		expect(isValidSlug(slug)).toBe(true);
	});
});

describe('fallbacks and validation', () => {
	it('falls back to a short random id when nothing is left', () => {
		const slug = slugOrShortId('你好世界', 'zh-Hans');

		expect(slug).toMatch(/^[a-z0-9]{10}$/);
		expect(shortSlugId()).not.toBe(shortSlugId());
	});

	it.each([
		['hello-world', true],
		['hello--world', false],
		['-hello', false],
		['Hello', false],
		['hello_world', false],
		['', false]
	])('validates %s as %s', (slug, expected) => {
		expect(isValidSlug(slug)).toBe(expected);
	});

	it('appends numeric suffixes within the limit', () => {
		expect(withNumericSuffix('news', 2)).toBe('news-2');
		expect(withNumericSuffix('a'.repeat(MAX_SLUG_LENGTH), 12).length).toBe(MAX_SLUG_LENGTH);
	});
});
