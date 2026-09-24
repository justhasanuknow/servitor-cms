import type { UiLocale } from '../../constants/preferences';
import { defineCustomServerStrategy } from '../../paraglide/runtime';

export const REQUEST_LOCALE_STRATEGY = 'custom-request';

const requestLocales = new WeakMap<Request, UiLocale>();

export function rememberRequestLocale(request: Request, locale: UiLocale): void {
	requestLocales.set(request, locale);
}

export function registerRequestLocaleStrategy(): void {
	defineCustomServerStrategy(REQUEST_LOCALE_STRATEGY, {
		getLocale: (request) => {
			if (request === undefined) {
				return undefined;
			}

			return requestLocales.get(request);
		}
	});
}
