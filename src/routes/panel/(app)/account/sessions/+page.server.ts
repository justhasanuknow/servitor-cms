import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAccountActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import {
	listOwnSessions,
	revokeOtherOwnSessions,
	revokeOwnSession
} from '$lib/server/auth/sessions';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const revokeSchema = z.object({ sessionId: z.uuid() });

export const load: PageServerLoad = ({ locals }) => {
	const { user, session } = requireAccountActor(locals);

	return { sessions: listOwnSessions(getRuntime().db, user.id, session.id) };
};

export const actions: Actions = {
	revoke: async (event) => {
		const { user, session } = requireAccountActor(event.locals);
		const form = revokeSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'not_found' as const });
		}

		const revoked = revokeOwnSession(
			getRuntime().db,
			createAuthRequest(event),
			user,
			session.id,
			form.data.sessionId
		);

		if (!revoked) {
			return fail(404, { error: 'not_found' as const });
		}

		return { revoked: 'one' as const };
	},
	revokeOthers: async (event) => {
		const { user, session } = requireAccountActor(event.locals);

		revokeOtherOwnSessions(getRuntime().db, createAuthRequest(event), user, session.id);

		return { revoked: 'others' as const };
	}
};
