import { building } from '$app/environment';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { initRuntime } from '$lib/server/runtime';

export const init: ServerInit = () => {
	if (building) {
		return;
	}

	initRuntime();
};

const handleParaglide: Handle = ({ event, resolve }) => {
	return paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale));
			}
		});
	});
};

export const handle: Handle = handleParaglide;
