import { describe, expect, it } from 'vitest';
import { resolveUiLocale } from './locale-resolution';

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
