import type { Reroute } from '@sveltejs/kit';
import { defineCustomClientStrategy, deLocalizeUrl } from '$lib/paraglide/runtime';

defineCustomClientStrategy('custom-document', {
	getLocale: () => {
		if (typeof document === 'undefined') {
			return undefined;
		}

		return document.documentElement.lang || undefined;
	},
	setLocale: (locale) => {
		document.documentElement.lang = locale;
	}
});

export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname;
