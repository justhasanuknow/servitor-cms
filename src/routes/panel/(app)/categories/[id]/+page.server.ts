import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { deleteCategory, findCategory, updateCategory } from '$lib/server/categories/categories';
import { readCategoryTranslations } from '$lib/server/categories/category-form';
import { readFormFields } from '$lib/server/http/form';
import { defaultLanguageCode, listContentLanguages } from '$lib/server/languages/languages';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const categoryIdSchema = z.uuid();

function manager(event: Pick<RequestEvent, 'locals'>) {
	const { user } = requireActor(event.locals);

	requirePermission(user, 'category.manage', null);

	return user;
}

function categoryId(event: Pick<RequestEvent, 'params'>): string {
	const parsed = categoryIdSchema.safeParse(event.params.id);

	if (!parsed.success) {
		error(404, { message: 'Not found' });
	}

	return parsed.data;
}

export const load: PageServerLoad = (event) => {
	manager(event);

	const { db } = getRuntime();
	const category = findCategory(db, categoryId(event));

	if (category === null) {
		error(404, { message: 'Not found' });
	}

	return {
		category,
		languages: listContentLanguages(db),
		defaultLanguage: defaultLanguageCode(db)
	};
};

export const actions: Actions = {
	update: async (event) => {
		const user = manager(event);
		const id = categoryId(event);
		const runtime = getRuntime();
		const translations = readCategoryTranslations(
			await readFormFields(event.request),
			listContentLanguages(runtime.db)
		);

		if (translations === null) {
			return fail(400, { error: 'invalid_input' as const, languageCode: null });
		}

		const result = updateCategory(runtime, createAuthRequest(event), user, id, translations);

		if (result.status === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result.status === 'saved') {
			return { saved: true };
		}

		if ('languageCode' in result) {
			return fail(400, { error: result.status, languageCode: result.languageCode });
		}

		return fail(400, { error: result.status, languageCode: null });
	},
	delete: async (event) => {
		const user = manager(event);
		const result = deleteCategory(
			getRuntime(),
			createAuthRequest(event),
			user,
			categoryId(event)
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result === 'in_use') {
			return fail(400, { error: result, languageCode: null });
		}

		redirect(303, PANEL_ROUTES.categories);
	}
};
