import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { requireActor } from '$lib/server/auth/actor';
import { readFormFields } from '$lib/server/http/form';
import { defaultLanguageCode, listContentLanguages } from '$lib/server/languages/languages';
import { readPageNumber } from '$lib/server/media/media-form';
import { can, requirePermission } from '$lib/server/permissions/permissions';
import { readLanguageCode } from '$lib/server/posts/post-form';
import { createPost, listPosts } from '$lib/server/posts/posts';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'post.list', null);

	const { db } = getRuntime();
	const canListAll = can(user, 'post.list_all', null);
	const showAll = canListAll && url.searchParams.get('scope') === 'all';

	return {
		posts: listPosts(db, user, showAll, readPageNumber(url.searchParams.get('page'))),
		showAll,
		canListAll,
		languages: listContentLanguages(db),
		defaultLanguage: defaultLanguageCode(db)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const { user } = requireActor(event.locals);

		requirePermission(user, 'post.create', null);

		const languageCode = readLanguageCode((await readFormFields(event.request)).languageCode);

		if (languageCode === null) {
			return fail(400, { error: 'unknown_language' as const });
		}

		const result = createPost(getRuntime(), user, languageCode);

		if (result.status !== 'created') {
			return fail(400, { error: result.status });
		}

		redirect(303, resolve(`/panel/posts/${result.postId}/${result.languageCode}`));
	}
};
