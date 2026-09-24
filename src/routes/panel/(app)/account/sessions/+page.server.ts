import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAccountActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import {
	listOwnSessions,
	revokeOtherOwnSessions,
	revokeOwnSession
} from '$lib/server/auth/sessions';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const confirmationSchema = z.object({
	password: passwordField,
	totpCode: optionalCodeField
});

const revokeSchema = confirmationSchema.extend({ sessionId: z.uuid() });

export const load: PageServerLoad = ({ locals }) => {
	const { user, session } = requireAccountActor(locals);

	return {
		sessions: listOwnSessions(getRuntime().db, user.id, session.id),
		actorTwoFactorEnabled: user.twoFactorEnabled === true
	};
};

export const actions: Actions = {
	revoke: async (event) => {
		const { user, session } = requireAccountActor(event.locals);
		const form = revokeSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = await revokeOwnSession(
			getRuntime(),
			createAuthRequest(event),
			user,
			session.id,
			form.data.sessionId,
			{ password: form.data.password, totpCode: form.data.totpCode }
		);

		if (result === 'not_found') {
			return fail(404, { error: result });
		}

		if (result !== 'revoked') {
			return fail(400, { error: result });
		}

		return { revoked: 'one' as const };
	},
	revokeOthers: async (event) => {
		const { user, session } = requireAccountActor(event.locals);
		const form = confirmationSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = await revokeOtherOwnSessions(
			getRuntime(),
			createAuthRequest(event),
			user,
			session.id,
			{ password: form.data.password, totpCode: form.data.totpCode }
		);

		if (result.status !== 'revoked') {
			return fail(400, { error: result.status });
		}

		return { revoked: 'others' as const };
	}
};
