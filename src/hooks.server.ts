import { building, dev } from '$app/environment';
import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { reportServerError } from '$lib/server/errors/server-error';
import { applySecurityHeaders } from '$lib/server/http/security-headers';
import { getLogger, initRuntime } from '$lib/server/runtime';

export const init: ServerInit = () => {
	if (building) {
		return;
	}

	initRuntime();
};

const handleRequestContext: Handle = ({ event, resolve }) => {
	event.locals.requestId = crypto.randomUUID();

	return resolve(event);
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	applySecurityHeaders(response.headers, !dev);

	return response;
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

export const handle: Handle = sequence(
	handleRequestContext,
	handleSecurityHeaders,
	handleParaglide
);

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	return reportServerError(
		{
			error,
			status,
			message,
			requestId: event.locals.requestId,
			method: event.request.method,
			routeId: event.route.id
		},
		getLogger()
	);
};
