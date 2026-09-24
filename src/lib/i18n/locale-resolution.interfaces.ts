import type { UiLocale } from '$lib/constants/preferences';

export interface LocaleSources {
	preference: UiLocale | null;
	cookie: string | undefined;
	acceptLanguage: string | null;
}
