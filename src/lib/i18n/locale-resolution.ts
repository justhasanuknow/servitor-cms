import type { UiLocale } from '$lib/constants/preferences';
import { matchLanguageTag, negotiateLocale, toUiLocale } from './locale-negotiation';
import type { LocaleSources } from './locale-resolution.interfaces';

export const DEFAULT_UI_LOCALE: UiLocale = 'en';

export function contentUiLocale(languageCode: string): UiLocale {
	return matchLanguageTag(languageCode) ?? DEFAULT_UI_LOCALE;
}

export function resolveUiLocale(sources: LocaleSources): UiLocale {
	return (
		sources.preference ??
		toUiLocale(sources.cookie) ??
		negotiateLocale(sources.acceptLanguage) ??
		DEFAULT_UI_LOCALE
	);
}
