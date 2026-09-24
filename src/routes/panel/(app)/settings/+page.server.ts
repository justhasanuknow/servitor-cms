import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import { readFormFields } from '$lib/server/http/form';
import { MAX_LANGUAGE_TAG_LENGTH } from '$lib/server/languages/language-tags';
import { listEnabledLanguages } from '$lib/server/languages/languages';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import {
	API_RATE_LIMIT_RANGE,
	loadSystemSettings,
	REVISION_RETENTION_RANGE,
	SITE_NAME_MAX_LENGTH,
	updateSystemSettings
} from '$lib/server/settings/system-settings';
import type { Actions, PageServerLoad } from './$types';

const checkbox = z
	.literal('on')
	.optional()
	.transform((value) => value === 'on');

const settingsSchema = z.object({
	siteName: z.string().trim().min(1).max(SITE_NAME_MAX_LENGTH),
	publicSiteEnabled: checkbox,
	defaultContentLanguage: z.string().trim().min(1).max(MAX_LANGUAGE_TAG_LENGTH),
	requireTwoFactorForAdmins: checkbox,
	defaultApiRateLimit: z.coerce
		.number()
		.int()
		.min(API_RATE_LIMIT_RANGE.min)
		.max(API_RATE_LIMIT_RANGE.max),
	revisionRetention: z.coerce
		.number()
		.int()
		.min(REVISION_RETENTION_RANGE.min)
		.max(REVISION_RETENTION_RANGE.max),
	password: passwordField,
	totpCode: optionalCodeField
});

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'settings.manage', null);

	const { db } = getRuntime();

	return {
		settings: loadSystemSettings(db),
		languages: listEnabledLanguages(db),
		actorTwoFactorEnabled: user.twoFactorEnabled === true,
		limits: {
			siteName: SITE_NAME_MAX_LENGTH,
			apiRateLimit: API_RATE_LIMIT_RANGE,
			revisionRetention: REVISION_RETENTION_RANGE
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireActor(event.locals);

		requirePermission(user, 'settings.manage', null);

		const form = settingsSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const { password, totpCode, ...values } = form.data;
		const result = await updateSystemSettings(
			getRuntime(),
			createAuthRequest(event),
			user,
			values,
			{ password, totpCode }
		);

		if (result === 'updated' || result === 'unchanged') {
			return { result };
		}

		return fail(400, { error: result });
	}
};
