import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { MANAGED_ROLES } from '$lib/constants/users';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import { readFormFields } from '$lib/server/http/form';
import { can, requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import {
	changeUserRole,
	createInviteLink,
	createPasswordResetLink,
	findManagedUser,
	setPublishDirectly,
	setUserActive
} from '$lib/server/users/user-management';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const userIdSchema = z.uuid();

const toggleSchema = z.object({ value: z.enum(['true', 'false']) });

const roleChangeSchema = z.object({
	role: z.enum(MANAGED_ROLES),
	password: passwordField,
	totpCode: optionalCodeField
});

function targetId(event: Pick<RequestEvent, 'params'>): string {
	const parsed = userIdSchema.safeParse(event.params.id);

	if (!parsed.success) {
		error(404, { message: 'Not found' });
	}

	return parsed.data;
}

async function readToggle(event: RequestEvent): Promise<boolean | null> {
	const form = toggleSchema.safeParse(await readFormFields(event.request));

	if (!form.success) {
		return null;
	}

	return form.data.value === 'true';
}

export const load: PageServerLoad = (event) => {
	const { user } = requireActor(event.locals);

	requirePermission(user, 'user.list', null);

	const target = findManagedUser(getRuntime().db, targetId(event));

	if (!target) {
		error(404, { message: 'Not found' });
	}

	return {
		target,
		actorTwoFactorEnabled: user.twoFactorEnabled === true,
		permissions: {
			setActive: can(user, 'user.set_active', target),
			changeRole: can(user, 'user.change_role', target),
			setPublishDirectly: can(user, 'user.set_publish_directly', target),
			passwordResetLink:
				target.status === 'active' && can(user, 'user.create_password_reset_link', target),
			inviteLink:
				target.status === 'invited' && can(user, 'user.create', { role: target.role })
		}
	};
};

export const actions: Actions = {
	setActive: async (event) => {
		const { user } = requireActor(event.locals);
		const id = targetId(event);
		const value = await readToggle(event);

		if (value === null) {
			return fail(400, { action: 'setActive' as const, error: 'invalid_input' as const });
		}

		const result = setUserActive(getRuntime(), createAuthRequest(event), user, id, value);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		return { action: 'setActive' as const, active: value };
	},
	setPublishDirectly: async (event) => {
		const { user } = requireActor(event.locals);
		const id = targetId(event);
		const value = await readToggle(event);

		if (value === null) {
			return fail(400, {
				action: 'setPublishDirectly' as const,
				error: 'invalid_input' as const
			});
		}

		const result = setPublishDirectly(getRuntime(), createAuthRequest(event), user, id, value);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		return { action: 'setPublishDirectly' as const, changed: true };
	},
	changeRole: async (event) => {
		const { user } = requireActor(event.locals);
		const id = targetId(event);
		const form = roleChangeSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'changeRole' as const, error: 'invalid_input' as const });
		}

		const result = await changeUserRole(
			getRuntime(),
			createAuthRequest(event),
			user,
			id,
			form.data.role,
			{ password: form.data.password, totpCode: form.data.totpCode }
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result === 'updated' || result === 'unchanged') {
			return { action: 'changeRole' as const, changed: true };
		}

		return fail(400, { action: 'changeRole' as const, error: result });
	},
	passwordResetLink: async (event) => {
		const { user } = requireActor(event.locals);
		const result = createPasswordResetLink(
			getRuntime(),
			createAuthRequest(event),
			user,
			targetId(event)
		);

		if (result.status === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result.status === 'not_applicable') {
			return fail(400, { action: 'passwordResetLink' as const, error: result.status });
		}

		return { action: 'passwordResetLink' as const, link: result.link };
	},
	inviteLink: async (event) => {
		const { user } = requireActor(event.locals);
		const result = createInviteLink(
			getRuntime(),
			createAuthRequest(event),
			user,
			targetId(event)
		);

		if (result.status === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result.status === 'not_applicable') {
			return fail(400, { action: 'inviteLink' as const, error: result.status });
		}

		return { action: 'inviteLink' as const, link: result.link };
	}
};
