import type { Cookies } from '@sveltejs/kit';
import {
	LOCALE_COOKIE,
	PREFERENCE_COOKIE_MAX_AGE_SECONDS,
	THEME_COOKIE,
	type UiLocale
} from '../../constants/preferences';
import type { ThemeChoice, UserPreferences } from './preferences.interfaces';
import { serializeTheme } from './preferences';

const HOST_COOKIE_PREFIX = '__Host-';

export function preferenceCookieName(name: string, secure: boolean): string {
	if (secure) {
		return `${HOST_COOKIE_PREFIX}${name}`;
	}

	return name;
}

export function readLocaleCookie(cookies: Cookies, secure: boolean): string | undefined {
	return cookies.get(preferenceCookieName(LOCALE_COOKIE, secure));
}

export function readThemeCookie(cookies: Cookies, secure: boolean): string | undefined {
	return cookies.get(preferenceCookieName(THEME_COOKIE, secure));
}

export function writeLocaleCookie(
	cookies: Cookies,
	locale: UiLocale | null,
	secure: boolean
): void {
	const name = preferenceCookieName(LOCALE_COOKIE, secure);

	if (locale === null) {
		cookies.delete(name, { path: '/', secure });

		return;
	}

	cookies.set(name, locale, cookieOptions(secure));
}

export function writeThemeCookie(cookies: Cookies, theme: ThemeChoice, secure: boolean): void {
	cookies.set(
		preferenceCookieName(THEME_COOKIE, secure),
		serializeTheme(theme),
		cookieOptions(secure)
	);
}

export function mirrorPreferenceCookies(
	cookies: Cookies,
	preferences: UserPreferences,
	secure: boolean
): void {
	if (readThemeCookie(cookies, secure) !== serializeTheme(preferences.theme)) {
		writeThemeCookie(cookies, preferences.theme, secure);
	}

	if (
		preferences.uiLocale !== null &&
		readLocaleCookie(cookies, secure) !== preferences.uiLocale
	) {
		writeLocaleCookie(cookies, preferences.uiLocale, secure);
	}
}

function cookieOptions(secure: boolean) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure,
		maxAge: PREFERENCE_COOKIE_MAX_AGE_SECONDS
	};
}
