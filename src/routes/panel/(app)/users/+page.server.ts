import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { MANAGED_ROLES } from '$lib/constants/users';
import { getLocale } from '$lib/paraglide/runtime';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { emailField } from '$lib/server/auth/form-fields';
import { emailInvitation } from '$lib/server/email/account-emails';
import { readFormFields } from '$lib/server/http/form';
import { can, requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import { inviteUser, listManagedUsers } from '$lib/server/users/user-management';
import type { Actions, PageServerLoad } from './$types';

const inviteSchema = z.object({
	email: emailField,
	name: z.string().trim().min(1).max(100),
	role: z.enum(MANAGED_ROLES)
});

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'user.list', null);

	return {
		users: listManagedUsers(getRuntime().db),
		invitableRoles: MANAGED_ROLES.filter((role) => can(user, 'user.create', { role }))
	};
};

export const actions: Actions = {
	invite: async (event) => {
		const { user } = requireActor(event.locals);

		requirePermission(user, 'user.list', null);

		const form = inviteSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		requirePermission(user, 'user.create', { role: form.data.role });

		const runtime = getRuntime();
		const result = inviteUser(runtime, createAuthRequest(event), user, form.data);

		if (result.status === 'email_taken') {
			return fail(400, { error: result.status });
		}

		const email = await emailInvitation(
			runtime,
			form.data.email,
			user.name,
			result.link,
			getLocale()
		);

		return {
			invited: { name: form.data.name, address: form.data.email, link: result.link, email }
		};
	}
};
