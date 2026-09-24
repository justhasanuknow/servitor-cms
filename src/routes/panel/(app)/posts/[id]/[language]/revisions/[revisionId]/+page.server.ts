import { error } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { requireActor } from '$lib/server/auth/actor';
import { listContentLanguages } from '$lib/server/languages/languages';
import { can } from '$lib/server/permissions/permissions';
import { languageParam, postIdParam } from '$lib/server/posts/post-form';
import { postSubject } from '$lib/server/posts/posts';
import { restoreAndReturn, revisionIdParam } from '$lib/server/posts/revision-actions';
import { loadRevision } from '$lib/server/posts/revisions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const { user } = requireActor(locals);
	const postId = postIdParam(params.id);
	const languageCode = languageParam(params.language);
	const revisionId = revisionIdParam(params.revisionId);
	const runtime = getRuntime();
	const revision = loadRevision(runtime, user, postId, languageCode, revisionId);

	if (revision === null) {
		error(404, { message: 'Not found' });
	}

	const { post, translation, ...details } = revision;

	return {
		postId,
		languageCode,
		ownerName: post.ownerName,
		status: translation.status,
		revision: details,
		canRestore: can(user, 'revision.restore', postSubject(post)),
		languages: listContentLanguages(runtime.db)
	};
};

export const actions: Actions = {
	restore: ({ locals, params }) => {
		const { user } = requireActor(locals);
		const postId = postIdParam(params.id);
		const languageCode = languageParam(params.language);

		return restoreAndReturn(
			user,
			postId,
			languageCode,
			revisionIdParam(params.revisionId),
			resolve(`/panel/posts/${postId}/${languageCode}`)
		);
	}
};
