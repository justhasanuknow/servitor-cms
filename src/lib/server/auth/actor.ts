import { redirect } from '@sveltejs/kit';
import { PANEL_ROUTES } from '../../constants/routes';
import type { Actor } from './actor.interfaces';

export function requireActor(locals: App.Locals): Actor {
	if (locals.user === null || locals.session === null) {
		redirect(303, PANEL_ROUTES.login);
	}

	return { user: locals.user, session: locals.session };
}
