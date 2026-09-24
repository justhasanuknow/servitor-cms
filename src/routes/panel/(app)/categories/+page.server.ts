import { fail } from '@sveltejs/kit';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { createCategory, listCategories } from '$lib/server/categories/categories';
import { readCategoryTranslations } from '$lib/server/categories/category-form';
import { readFormFields } from '$lib/server/http/form';
import { defaultLanguageCode, listContentLanguages } from '$lib/server/languages/languages';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'category.manage', null);

	const { db } = getRuntime();

	return {
		categories: listCategories(db),
		languages: listContentLanguages(db),
		defaultLanguage: defaultLanguageCode(db)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const { user } = requireActor(event.locals);

		requirePermission(user, 'category.manage', null);

		const runtime = getRuntime();
		const translations = readCategoryTranslations(
			await readFormFields(event.request),
			listContentLanguages(runtime.db)
		);

		if (translations === null) {
			return fail(400, { error: 'invalid_input' as const, languageCode: null });
		}

		const result = createCategory(runtime, createAuthRequest(event), user, translations);

		if (result.status === 'saved') {
			return { created: true };
		}

		if ('languageCode' in result) {
			return fail(400, { error: result.status, languageCode: result.languageCode });
		}

		return fail(400, { error: result.status, languageCode: null });
	}
};
