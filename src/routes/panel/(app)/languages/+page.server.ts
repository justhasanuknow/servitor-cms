import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { readFormFields } from '$lib/server/http/form';
import { MAX_LANGUAGE_TAG_LENGTH } from '$lib/server/languages/language-tags';
import {
	addContentLanguage,
	deleteContentLanguage,
	listContentLanguages,
	setContentLanguageEnabled,
	updateContentLanguage
} from '$lib/server/languages/languages';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const NAME_MAX_LENGTH = 100;

const sortOrderField = z.coerce.number().int().min(-1000).max(1000);

const codeField = z.string().trim().min(1).max(MAX_LANGUAGE_TAG_LENGTH);

const optionalName = z
	.string()
	.trim()
	.max(NAME_MAX_LENGTH)
	.transform((value) => {
		if (value === '') {
			return null;
		}

		return value;
	});

const addSchema = z.object({
	code: codeField,
	name: optionalName,
	nativeName: optionalName,
	sortOrder: sortOrderField
});

const updateSchema = z.object({
	code: codeField,
	name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
	nativeName: z.string().trim().min(1).max(NAME_MAX_LENGTH),
	sortOrder: sortOrderField
});

const toggleSchema = z.object({ code: codeField, value: z.enum(['true', 'false']) });

const codeSchema = z.object({ code: codeField });

function manager(event: RequestEvent) {
	const { user } = requireActor(event.locals);

	requirePermission(user, 'language.manage', null);

	return user;
}

export const load: PageServerLoad = (event) => {
	manager(event);

	return { languages: listContentLanguages(getRuntime().db) };
};

export const actions: Actions = {
	add: async (event) => {
		const user = manager(event);
		const form = addSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'add' as const, error: 'invalid_input' as const });
		}

		const result = addContentLanguage(getRuntime(), createAuthRequest(event), user, form.data);

		if (result.status !== 'added') {
			return fail(400, { action: 'add' as const, error: result.status });
		}

		return { action: 'add' as const, code: result.code };
	},
	update: async (event) => {
		const user = manager(event);
		const form = updateSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'update' as const, error: 'invalid_input' as const });
		}

		const { code, ...input } = form.data;
		const result = updateContentLanguage(
			getRuntime(),
			createAuthRequest(event),
			user,
			code,
			input
		);

		if (result === 'not_found' || result === 'default_language') {
			return fail(400, { action: 'update' as const, error: result });
		}

		return { action: 'update' as const, code };
	},
	setEnabled: async (event) => {
		const user = manager(event);
		const form = toggleSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'setEnabled' as const, error: 'invalid_input' as const });
		}

		const result = setContentLanguageEnabled(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.data.code,
			form.data.value === 'true'
		);

		if (result === 'not_found' || result === 'default_language') {
			return fail(400, { action: 'setEnabled' as const, error: result });
		}

		return { action: 'setEnabled' as const, code: form.data.code };
	},
	delete: async (event) => {
		const user = manager(event);
		const form = codeSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'delete' as const, error: 'invalid_input' as const });
		}

		const result = deleteContentLanguage(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.data.code
		);

		if (result !== 'deleted') {
			return fail(400, { action: 'delete' as const, error: result });
		}

		return { action: 'delete' as const, code: form.data.code };
	}
};
