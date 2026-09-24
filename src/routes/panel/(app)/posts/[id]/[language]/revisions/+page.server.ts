import { error } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { requireActor } from '$lib/server/auth/actor';
import { readFormFields } from '$lib/server/http/form';
import { listContentLanguages } from '$lib/server/languages/languages';
import { can } from '$lib/server/permissions/permissions';
import { languageParam, postIdParam } from '$lib/server/posts/post-form';
import { postSubject } from '$lib/server/posts/posts';
import { readRevisionId, restoreAndReturn } from '$lib/server/posts/revision-actions';
import { loadRevisionHistory } from '$lib/server/posts/revisions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const { user } = requireActor(locals);
	const postId = postIdParam(params.id);
	const languageCode = languageParam(params.language);
	const runtime = getRuntime();
	const history = loadRevisionHistory(runtime, user, postId, languageCode);

	if (history === null) {
		error(404, { message: 'Not found' });
	}

	return {
		postId,
		languageCode,
		ownerName: history.post.ownerName,
		status: history.translation.status,
		revisions: history.revisions,
		canRestore: can(user, 'revision.restore', postSubject(history.post)),
		canEdit: can(user, 'post.edit', postSubject(history.post)),
		languages: listContentLanguages(runtime.db)
	};
};

export const actions: Actions = {
	restore: async ({ locals, params, request }) => {
		const { user } = requireActor(locals);
		const postId = postIdParam(params.id);
		const languageCode = languageParam(params.language);
		const revisionId = readRevisionId((await readFormFields(request)).revisionId);

		return restoreAndReturn(
			user,
			postId,
			languageCode,
			revisionId,
			resolve(`/panel/posts/${postId}/${languageCode}`)
		);
	}
};
