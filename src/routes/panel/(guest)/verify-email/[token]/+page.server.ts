import { fail } from '@sveltejs/kit';
import { getLocale } from '$lib/paraglide/runtime';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { getRuntime } from '$lib/server/runtime';
import { confirmEmailChange, describeEmailChange } from '$lib/server/users/email-change';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	return { change: describeEmailChange(getRuntime().db, params.token) };
};

export const actions: Actions = {
	default: (event) => {
		const result = confirmEmailChange(
			getRuntime(),
			createAuthRequest(event),
			event.params.token,
			getLocale()
		);

		if (result !== 'changed') {
			return fail(400, { error: result });
		}

		return { changed: true };
	}
};
