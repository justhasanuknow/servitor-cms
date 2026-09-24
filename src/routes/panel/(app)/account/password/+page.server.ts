import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import { changeOwnPassword } from '$lib/server/auth/password-change';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const changePasswordSchema = z.object({
	currentPassword: passwordField,
	newPassword: passwordField,
	confirmPassword: z.string().max(1024),
	totpCode: optionalCodeField
});

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	return {
		forced: user.mustChangePassword === true,
		twoFactorEnabled: user.twoFactorEnabled === true
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireActor(event.locals);
		const form = changePasswordSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		if (form.data.newPassword !== form.data.confirmPassword) {
			return fail(400, { error: 'mismatch' as const });
		}

		const result = await changeOwnPassword(getRuntime(), createAuthRequest(event), user, {
			currentPassword: form.data.currentPassword,
			newPassword: form.data.newPassword,
			totpCode: form.data.totpCode
		});

		if (result === 'changed') {
			return { success: true };
		}

		if (result === 'rate_limited') {
			return fail(429, { error: result });
		}

		return fail(400, { error: result });
	}
};
