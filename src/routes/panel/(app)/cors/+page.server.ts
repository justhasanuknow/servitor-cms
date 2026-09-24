import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { CORS_ORIGIN_MAX_LENGTH } from '$lib/constants/api';
import { addCorsOrigin, listCorsOrigins, removeCorsOrigin } from '$lib/server/api/cors';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { readFormFields } from '$lib/server/http/form';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const addSchema = z.object({ origin: z.string().max(CORS_ORIGIN_MAX_LENGTH) });

const removeSchema = z.object({ id: z.uuid() });

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'cors.manage', null);

	return {
		origins: listCorsOrigins(getRuntime().db),
		maxLength: CORS_ORIGIN_MAX_LENGTH
	};
};

export const actions: Actions = {
	add: async (event) => {
		const { user } = requireActor(event.locals);
		const form = addSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_origin' as const });
		}

		const result = addCorsOrigin(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.data.origin
		);

		if (result !== 'added') {
			return fail(400, { error: result });
		}

		return { changed: 'added' as const };
	},
	remove: async (event) => {
		const { user } = requireActor(event.locals);
		const form = removeSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = removeCorsOrigin(getRuntime(), createAuthRequest(event), user, form.data.id);

		if (result !== 'removed') {
			return fail(404, { error: result });
		}

		return { changed: 'removed' as const };
	}
};
