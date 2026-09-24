import { fail, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { createAuthRequest } from '../auth/auth-request';
import { readFormFields } from '../http/form';
import { getRuntime } from '../runtime';
import type { AccountLinkCompleter } from './account-links.interfaces';

const newPasswordSchema = z.object({
	password: z.string().min(1).max(1024),
	confirmation: z.string().max(1024)
});

export async function submitAccountLink(
	event: RequestEvent<{ token: string }>,
	complete: AccountLinkCompleter
) {
	const form = newPasswordSchema.safeParse(await readFormFields(event.request));

	if (!form.success) {
		return fail(400, { error: 'invalid_input' as const });
	}

	const result = await complete(
		getRuntime(),
		createAuthRequest(event),
		event.params.token,
		form.data
	);

	if (result === 'completed') {
		return { completed: true };
	}

	return fail(400, { error: result });
}
