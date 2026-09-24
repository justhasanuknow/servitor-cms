export const UI_LOCALES = ['en', 'tr', 'fr', 'de', 'ja', 'zh-Hans'] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

export const UI_LOCALE_AUTONYMS: Record<UiLocale, string> = {
	en: 'English',
	tr: 'Türkçe',
	fr: 'Français',
	de: 'Deutsch',
	ja: '日本語',
	'zh-Hans': '简体中文'
};

export const THEME_PALETTES = ['neutral', 'red', 'blue', 'green', 'pink'] as const;

export type ThemePalette = (typeof THEME_PALETTES)[number];

export const THEME_MODES = ['light', 'dark', 'system'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export const LOCALE_COOKIE = 'servitor_locale';

export const THEME_COOKIE = 'servitor_theme';

export const PREFERENCE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export const BIO_MAX_LENGTH = 1000;

export const DISPLAY_NAME_MAX_LENGTH = 100;
