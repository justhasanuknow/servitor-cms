import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import {
	preferenceCookieName,
	readLocaleCookie,
	writeLocaleCookie,
	writeThemeCookie
} from './preference-cookies';

function memoryCookies() {
	const values = new Map<string, string>();
	const options = new Map<string, unknown>();
	const cookies = {
		get: (name: string) => values.get(name),
		getAll: () => [...values].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string, cookieOptions: unknown) => {
			values.set(name, value);
			options.set(name, cookieOptions);
		},
		delete: (name: string) => {
			values.delete(name);
		},
		serialize: () => ''
	} satisfies Cookies;

	return { cookies, values, options };
}

describe('preference cookies', () => {
	it('use the __Host- prefix over HTTPS and plain names without it', () => {
		expect(preferenceCookieName('servitor_locale', true)).toBe('__Host-servitor_locale');
		expect(preferenceCookieName('servitor_locale', false)).toBe('servitor_locale');
	});

	it('write secure host-only cookies over HTTPS', () => {
		const { cookies, values, options } = memoryCookies();

		writeLocaleCookie(cookies, 'tr', true);
		writeThemeCookie(cookies, { palette: 'blue', mode: 'dark' }, true);

		expect([...values.keys()]).toEqual(['__Host-servitor_locale', '__Host-servitor_theme']);
		expect(options.get('__Host-servitor_locale')).toMatchObject({
			path: '/',
			secure: true,
			httpOnly: true
		});
		expect(readLocaleCookie(cookies, true)).toBe('tr');
	});

	it('ignore a locale cookie without the prefix over HTTPS', () => {
		const { cookies } = memoryCookies();

		cookies.set('servitor_locale', 'de', {});

		expect(readLocaleCookie(cookies, true)).toBeUndefined();
		expect(readLocaleCookie(cookies, false)).toBe('de');
	});
});
