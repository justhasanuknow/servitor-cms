import type { UiLocale } from '$lib/constants/preferences';
import { negotiateLocale, toUiLocale } from './locale-negotiation';
import type { LocaleSources } from './locale-resolution.interfaces';

export const DEFAULT_UI_LOCALE: UiLocale = 'en';

export function resolveUiLocale(sources: LocaleSources): UiLocale {
	return (
		sources.preference ??
		toUiLocale(sources.cookie) ??
		negotiateLocale(sources.acceptLanguage) ??
		DEFAULT_UI_LOCALE
	);
}
