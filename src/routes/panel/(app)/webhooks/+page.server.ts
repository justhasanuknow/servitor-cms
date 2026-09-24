import { fail } from '@sveltejs/kit';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import { readConfirmation, readWebhookInput } from '$lib/server/webhooks/webhook-form';
import { createWebhook, listWebhooks } from '$lib/server/webhooks/webhooks';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'webhook.manage', null);

	return {
		webhooks: listWebhooks(getRuntime().db),
		actorTwoFactorEnabled: user.twoFactorEnabled === true
	};
};

export const actions: Actions = {
	create: async (event) => {
		const { user } = requireActor(event.locals);

		requirePermission(user, 'webhook.manage', null);

		const data = await event.request.formData();
		const input = readWebhookInput(data);
		const confirmation = readConfirmation(data);

		if (input === null || confirmation === null) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = await createWebhook(
			getRuntime(),
			createAuthRequest(event),
			user,
			input,
			confirmation
		);

		if (result.status !== 'created') {
			return fail(400, { error: result.status });
		}

		return { created: { id: result.id, secret: result.secret } };
	}
};
