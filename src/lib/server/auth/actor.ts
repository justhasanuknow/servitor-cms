import { redirect } from '@sveltejs/kit';
import { PANEL_ROUTES } from '../../constants/routes';
import { requirePermission } from '../permissions/permissions';
import type { Actor } from './actor.interfaces';

export function requireActor(locals: App.Locals): Actor {
	if (locals.user === null || locals.session === null) {
		redirect(303, PANEL_ROUTES.login);
	}

	return { user: locals.user, session: locals.session };
}

export function requireAccountActor(locals: App.Locals): Actor {
	const actor = requireActor(locals);

	requirePermission(actor.user, 'account.manage', null);

	return actor;
}
