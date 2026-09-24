import { describe, expect, it } from 'vitest';
import { contentUiLocale, resolveUiLocale } from './locale-resolution';

describe('contentUiLocale', () => {
	it.each([
		['tr', 'tr'],
		['de-AT', 'de'],
		['zh-Hans', 'zh-Hans'],
		['zh-CN', 'zh-Hans'],
		['zh-TW', 'en'],
		['es', 'en'],
		['pt-BR', 'en']
	])('uses %s content with the %s interface', (languageCode, locale) => {
		expect(contentUiLocale(languageCode)).toBe(locale);
	});
});

describe('resolveUiLocale', () => {
	it('prefers the saved user preference', () => {
		expect(resolveUiLocale({ preference: 'ja', cookie: 'tr', acceptLanguage: 'de' })).toBe(
			'ja'
		);
	});

	it('falls back to the cookie, then Accept-Language, then English', () => {
		expect(resolveUiLocale({ preference: null, cookie: 'tr', acceptLanguage: 'de' })).toBe(
			'tr'
		);
		expect(resolveUiLocale({ preference: null, cookie: 'nope', acceptLanguage: 'de' })).toBe(
			'de'
		);
		expect(resolveUiLocale({ preference: null, cookie: undefined, acceptLanguage: 'pt' })).toBe(
			'en'
		);
		expect(resolveUiLocale({ preference: null, cookie: undefined, acceptLanguage: null })).toBe(
			'en'
		);
	});
});
