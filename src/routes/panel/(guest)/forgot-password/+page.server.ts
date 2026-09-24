import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '$lib/paraglide/runtime';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { emailField } from '$lib/server/auth/form-fields';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import { requestPasswordReset } from '$lib/server/users/password-reset-request';
import type { Actions, PageServerLoad } from './$types';

const requestSchema = z.object({ email: emailField });

function requireEmail(): void {
	if (!getRuntime().mailer.enabled) {
		error(404, { message: 'Not found' });
	}
}

export const load: PageServerLoad = () => {
	requireEmail();

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		requireEmail();

		const form = requestSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = requestPasswordReset(
			getRuntime(),
			createAuthRequest(event),
			form.data.email,
			getLocale()
		);

		if (result === 'rate_limited') {
			return fail(429, { error: 'rate_limited' as const });
		}

		return { requested: form.data.email };
	}
};
