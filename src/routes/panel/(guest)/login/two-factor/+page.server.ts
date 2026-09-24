import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { codeField } from '$lib/server/auth/form-fields';
import { findPendingTwoFactorUser, verifySignInCode } from '$lib/server/auth/sign-in';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const TWO_FACTOR_METHODS = ['totp', 'backup_code'] as const;

const verifySchema = z.object({
	method: z.enum(TWO_FACTOR_METHODS),
	code: codeField
});

const methodEcho = z.enum(TWO_FACTOR_METHODS).catch('totp');

export const load: PageServerLoad = async (event) => {
	const userId = await findPendingTwoFactorUser(getRuntime(), createAuthRequest(event));

	return { pending: userId !== null };
};

export const actions: Actions = {
	default: async (event) => {
		const fields = await readFormFields(event.request);
		const form = verifySchema.safeParse(fields);

		if (!form.success) {
			return fail(400, {
				error: 'invalid_input' as const,
				method: methodEcho.parse(fields.method),
				retryAfterSeconds: 0
			});
		}

		const result = await verifySignInCode(getRuntime(), createAuthRequest(event), form.data);

		if (result.status === 'signed_in') {
			redirect(303, PANEL_ROUTES.root);
		}

		if (result.status === 'rate_limited') {
			return fail(429, {
				error: result.status,
				method: form.data.method,
				retryAfterSeconds: result.retryAfterSeconds
			});
		}

		if (result.status === 'locked') {
			return fail(429, {
				error: result.status,
				method: form.data.method,
				retryAfterSeconds: 0
			});
		}

		return fail(400, { error: result.status, method: form.data.method, retryAfterSeconds: 0 });
	}
};
