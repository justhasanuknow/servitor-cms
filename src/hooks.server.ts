import { building, dev } from '$app/environment';
import { redirect, type Handle, type HandleServerError, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { LOCALE_COOKIE, THEME_COOKIE } from '$lib/constants/preferences';
import { isMediaPath, isPanelPath } from '$lib/constants/routes';
import { resolveUiLocale } from '$lib/i18n/locale-resolution';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { resolvePanelRedirect } from '$lib/server/auth/access-gate';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { requiresTwoFactorEnrollment } from '$lib/server/auth/two-factor-policy';
import { reportServerError } from '$lib/server/errors/server-error';
import { applyPanelCachePolicy, applySecurityHeaders } from '$lib/server/http/security-headers';
import {
	registerRequestLocaleStrategy,
	rememberRequestLocale
} from '$lib/server/i18n/request-locale';
import { mirrorPreferenceCookies } from '$lib/server/preferences/preference-cookies';
import { DEFAULT_THEME, loadPreferences, panelTheme } from '$lib/server/preferences/preferences';
import { getLogger, getRuntime, startRuntime } from '$lib/server/runtime';
import { startScheduler } from '$lib/server/workflow/scheduler';

registerRequestLocaleStrategy();

export const init: ServerInit = async () => {
	if (building) {
		return;
	}

	startScheduler(await startRuntime());
};

const handleRequestContext: Handle = ({ event, resolve }) => {
	event.locals.requestId = crypto.randomUUID();
	event.locals.user = null;
	event.locals.session = null;
	event.locals.preferences = null;

	return resolve(event);
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	applySecurityHeaders(response.headers, !dev);
	applyPanelCachePolicy(response.headers, event.url.pathname);

	return response;
};

const handleAuthentication: Handle = async ({ event, resolve }) => {
	if (isMediaPath(event.url.pathname)) {
		return resolve(event);
	}

	const { auth, db } = getRuntime();
	const current = await auth.api.getSession({ headers: createAuthRequest(event).headers });

	if (current && !current.user.deactivatedAt) {
		const preferences = loadPreferences(db, current.user.id);

		event.locals.user = current.user;
		event.locals.session = current.session;
		event.locals.preferences = preferences;
		mirrorPreferenceCookies(event.cookies, preferences, event.url.protocol === 'https:');
	}

	return resolve(event);
};

const handleLocale: Handle = ({ event, resolve }) => {
	const locale = resolveUiLocale({
		preference: event.locals.preferences?.uiLocale ?? null,
		cookie: event.cookies.get(LOCALE_COOKIE),
		acceptLanguage: event.request.headers.get('accept-language')
	});

	rememberRequestLocale(event.request, locale);

	return resolve(event);
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

const handleTheme: Handle = ({ event, resolve }) => {
	let theme = DEFAULT_THEME;

	if (isPanelPath(event.url.pathname)) {
		theme = panelTheme(event.locals.preferences, event.cookies.get(THEME_COOKIE));
	}

	return resolve(event, {
		transformPageChunk: ({ html }) => {
			return html
				.replace('%servitor.palette%', theme.palette)
				.replace('%servitor.mode%', theme.mode);
		}
	});
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
	handleAuthentication,
	handleLocale,
	handleParaglide,
	handleTheme,
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
