import { completePasswordReset, describeAccountLink } from '$lib/server/users/account-links';
import { submitAccountLink } from '$lib/server/users/account-link-actions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	return { owner: describeAccountLink(getRuntime().db, 'password_reset', params.token) };
};

export const actions: Actions = {
	default: (event) => submitAccountLink(event, completePasswordReset)
};
