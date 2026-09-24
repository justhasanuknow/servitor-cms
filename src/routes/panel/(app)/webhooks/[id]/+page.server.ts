import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import { readConfirmation, readWebhookInput } from '$lib/server/webhooks/webhook-form';
import {
	deleteWebhook,
	findWebhook,
	listWebhookDeliveries,
	rotateWebhookSecret,
	updateWebhook
} from '$lib/server/webhooks/webhooks';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const idSchema = z.uuid();

function webhookId(value: string): string {
	const parsed = idSchema.safeParse(value);

	if (!parsed.success) {
		error(404, { message: 'Not found' });
	}

	return parsed.data;
}

function manager(event: Pick<RequestEvent, 'locals'>) {
	const { user } = requireActor(event.locals);

	requirePermission(user, 'webhook.manage', null);

	return user;
}

export const load: PageServerLoad = (event) => {
	const user = manager(event);
	const id = webhookId(event.params.id);
	const { db } = getRuntime();
	const webhook = findWebhook(db, id);

	if (webhook === null) {
		error(404, { message: 'Not found' });
	}

	return {
		webhook,
		deliveries: listWebhookDeliveries(db, id),
		actorTwoFactorEnabled: user.twoFactorEnabled === true
	};
};

export const actions: Actions = {
	update: async (event) => {
		const user = manager(event);
		const input = readWebhookInput(await event.request.formData());

		if (input === null) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = updateWebhook(
			getRuntime(),
			createAuthRequest(event),
			user,
			webhookId(event.params.id),
			input
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result !== 'updated') {
			return fail(400, { error: result });
		}

		return { saved: true };
	},
	rotate: async (event) => {
		const user = manager(event);
		const confirmation = readConfirmation(await event.request.formData());

		if (confirmation === null) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = await rotateWebhookSecret(
			getRuntime(),
			createAuthRequest(event),
			user,
			webhookId(event.params.id),
			confirmation
		);

		if (result.status === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result.status !== 'rotated') {
			return fail(400, { error: result.status });
		}

		return { rotated: result.secret };
	},
	delete: (event) => {
		const user = manager(event);
		const result = deleteWebhook(
			getRuntime(),
			createAuthRequest(event),
			user,
			webhookId(event.params.id)
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		redirect(303, resolve('/panel/webhooks'));
	}
};
