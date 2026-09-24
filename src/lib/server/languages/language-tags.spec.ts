import { describe, expect, it } from 'vitest';
import {
	baseLanguage,
	canonicalLanguageTag,
	isLanguageTag,
	suggestLanguageNames
} from './language-tags';

describe('canonicalLanguageTag', () => {
	it.each([
		['en', 'en'],
		['EN-gb', 'en-GB'],
		['zh-hans', 'zh-Hans'],
		['pt-br', 'pt-BR'],
		[' tr ', 'tr'],
		['sr-Latn-RS', 'sr-Latn-RS']
	])('canonicalizes %s to %s', (value, expected) => {
		expect(canonicalLanguageTag(value)).toBe(expected);
	});

	it.each(['', 'english', 'en_US', '../etc', 'x-private', 'und', 'e'.repeat(40), 'en--US'])(
		'rejects %s',
		(value) => {
			expect(canonicalLanguageTag(value)).toBeNull();
			expect(isLanguageTag(value)).toBe(false);
		}
	);
});

describe('language names', () => {
	it('suggests English and native names', () => {
		expect(suggestLanguageNames('de')).toEqual({ name: 'German', nativeName: 'Deutsch' });
		expect(suggestLanguageNames('tr')).toEqual({ name: 'Turkish', nativeName: 'Türkçe' });
	});

	it('extracts the base language', () => {
		expect(baseLanguage('pt-BR')).toBe('pt');
		expect(baseLanguage('zh-Hans')).toBe('zh');
	});
});
