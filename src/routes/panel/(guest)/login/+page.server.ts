import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { emailField, passwordField } from '$lib/server/auth/form-fields';
import { signInWithPassword } from '$lib/server/auth/sign-in';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import type { Actions } from './$types';

const signInSchema = z.object({
	email: emailField,
	password: passwordField
});

const emailEcho = z.string().max(254).catch('');

export const actions: Actions = {
	default: async (event) => {
		const fields = await readFormFields(event.request);
		const form = signInSchema.safeParse(fields);

		if (!form.success) {
			return fail(400, {
				error: 'invalid_input' as const,
				email: emailEcho.parse(fields.email),
				retryAfterSeconds: 0
			});
		}

		const result = await signInWithPassword(getRuntime(), createAuthRequest(event), form.data);

		if (result.status === 'signed_in') {
			redirect(303, PANEL_ROUTES.root);
		}

		if (result.status === 'two_factor_required') {
			redirect(303, PANEL_ROUTES.loginTwoFactor);
		}

		if (result.status === 'rate_limited') {
			return fail(429, {
				error: result.status,
				email: form.data.email,
				retryAfterSeconds: result.retryAfterSeconds
			});
		}

		if (result.status === 'locked') {
			return fail(429, {
				error: result.status,
				email: form.data.email,
				retryAfterSeconds: 0
			});
		}

		return fail(400, { error: result.status, email: form.data.email, retryAfterSeconds: 0 });
	}
};
