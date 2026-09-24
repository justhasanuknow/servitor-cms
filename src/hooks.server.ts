import { building, dev } from '$app/environment';
import { redirect, type Handle, type HandleServerError, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { resolvePanelRedirect } from '$lib/server/auth/access-gate';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { requiresTwoFactorEnrollment } from '$lib/server/auth/two-factor-policy';
import { reportServerError } from '$lib/server/errors/server-error';
import { applySecurityHeaders } from '$lib/server/http/security-headers';
import { getLogger, getRuntime, startRuntime } from '$lib/server/runtime';

export const init: ServerInit = async () => {
	if (building) {
		return;
	}

	await startRuntime();
};

const handleRequestContext: Handle = ({ event, resolve }) => {
	event.locals.requestId = crypto.randomUUID();
	event.locals.user = null;
	event.locals.session = null;

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

const handleAuthentication: Handle = async ({ event, resolve }) => {
	const { auth } = getRuntime();
	const current = await auth.api.getSession({ headers: createAuthRequest(event).headers });

	if (current && !current.user.deactivatedAt) {
		event.locals.user = current.user;
		event.locals.session = current.session;
	}

	return resolve(event);
};

const handlePanelAccess: Handle = ({ event, resolve }) => {
	const { db } = getRuntime();
	const user = event.locals.user;
	const target = resolvePanelRedirect({
		pathname: event.url.pathname,
		signedIn: user !== null,
		mustChangePassword: user?.mustChangePassword === true,
		twoFactorEnrollmentRequired: requiresTwoFactorEnrollment(db, user)
	});

	if (target !== null) {
		redirect(303, target);
	}

	return resolve(event);
};

export const handle: Handle = sequence(
	handleRequestContext,
	handleSecurityHeaders,
	handleParaglide,
	handleAuthentication,
	handlePanelAccess
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
