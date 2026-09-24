import type { Cookies } from '@sveltejs/kit';
import {
	LOCALE_COOKIE,
	PREFERENCE_COOKIE_MAX_AGE_SECONDS,
	THEME_COOKIE,
	type UiLocale
} from '../../constants/preferences';
import type { ThemeChoice, UserPreferences } from './preferences.interfaces';
import { serializeTheme } from './preferences';

export function writeLocaleCookie(
	cookies: Cookies,
	locale: UiLocale | null,
	secure: boolean
): void {
	if (locale === null) {
		cookies.delete(LOCALE_COOKIE, { path: '/', secure });

		return;
	}

	cookies.set(LOCALE_COOKIE, locale, cookieOptions(secure));
}

export function writeThemeCookie(cookies: Cookies, theme: ThemeChoice, secure: boolean): void {
	cookies.set(THEME_COOKIE, serializeTheme(theme), cookieOptions(secure));
}

export function mirrorPreferenceCookies(
	cookies: Cookies,
	preferences: UserPreferences,
	secure: boolean
): void {
	if (cookies.get(THEME_COOKIE) !== serializeTheme(preferences.theme)) {
		writeThemeCookie(cookies, preferences.theme, secure);
	}

	if (preferences.uiLocale !== null && cookies.get(LOCALE_COOKIE) !== preferences.uiLocale) {
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
