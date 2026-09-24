import { error, fail } from '@sveltejs/kit';
import { API_KEY_NAME_MAX_LENGTH } from '$lib/constants/api';
import { readApiKeyConfirmation, readApiKeyForm } from '$lib/server/api/api-key-form';
import { createApiKey, listApiKeys, revokeApiKey } from '$lib/server/api/api-keys';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { listCategories } from '$lib/server/categories/categories';
import { defaultLanguageCode, listContentLanguages } from '$lib/server/languages/languages';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import { API_RATE_LIMIT_RANGE, loadSystemSettings } from '$lib/server/settings/system-settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'api_key.manage', null);

	const { db } = getRuntime();
	const defaultLanguage = defaultLanguageCode(db);

	return {
		keys: listApiKeys(db),
		languages: listContentLanguages(db).map((language) => ({
			code: language.code,
			name: language.nativeName
		})),
		categories: listCategories(db).map((category) => ({
			id: category.id,
			name:
				category.translations.find((entry) => entry.languageCode === defaultLanguage)
					?.name ??
				category.translations[0]?.name ??
				category.id
		})),
		defaultRateLimit: loadSystemSettings(db).defaultApiRateLimit,
		actorTwoFactorEnabled: user.twoFactorEnabled === true,
		limits: { name: API_KEY_NAME_MAX_LENGTH, rateLimit: API_RATE_LIMIT_RANGE }
	};
};

export const actions: Actions = {
	create: async (event) => {
		const { user } = requireActor(event.locals);

		requirePermission(user, 'api_key.manage', null);

		const form = readApiKeyForm(await event.request.formData());

		if (form.status !== 'ok') {
			return fail(400, { error: form.status });
		}

		const result = await createApiKey(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.input,
			form.confirmation
		);

		if (result.status !== 'created') {
			return fail(400, { error: result.status });
		}

		return { created: { name: form.input.name, key: result.key } };
	},
	revoke: async (event) => {
		const { user } = requireActor(event.locals);

		requirePermission(user, 'api_key.manage', null);

		const form = readApiKeyConfirmation(await event.request.formData());

		if (form === null) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = await revokeApiKey(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.id,
			form.confirmation
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result !== 'revoked') {
			return fail(400, { error: result });
		}

		return { revoked: true };
	}
};
