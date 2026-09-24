import { redirect } from '@sveltejs/kit';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { signOut } from '$lib/server/auth/sessions';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const actor = event.locals.user;

	if (actor !== null) {
		await signOut(getRuntime(), createAuthRequest(event), actor);
	}

	redirect(303, PANEL_ROUTES.login);
};
