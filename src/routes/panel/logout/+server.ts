import { PANEL_ROUTES } from '$lib/constants/routes';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { signOut } from '$lib/server/auth/sessions';
import { CLEAR_SITE_DATA } from '$lib/server/http/security-headers';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const actor = event.locals.user;

	if (actor !== null) {
		await signOut(getRuntime(), createAuthRequest(event), actor);
	}

	return new Response(null, {
		status: 303,
		headers: { Location: PANEL_ROUTES.login, 'Clear-Site-Data': CLEAR_SITE_DATA }
	});
};
