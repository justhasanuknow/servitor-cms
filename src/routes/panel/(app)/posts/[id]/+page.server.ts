import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { requireActor } from '$lib/server/auth/actor';
import { listContentLanguages } from '$lib/server/languages/languages';
import { can, requirePermission } from '$lib/server/permissions/permissions';
import { postIdParam } from '$lib/server/posts/post-form';
import {
	findPost,
	listTranslations,
	postSubject,
	summarizeTranslations
} from '$lib/server/posts/posts';
import { getRuntime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const { user } = requireActor(locals);
	const postId = postIdParam(params.id);
	const { db } = getRuntime();
	const post = findPost(db, postId);

	if (post === null) {
		error(404, { message: 'Not found' });
	}

	requirePermission(user, 'post.view', postSubject(post));

	const translations = summarizeTranslations(db, listTranslations(db, [postId]));

	if (can(user, 'post.edit', postSubject(post)) && translations.length > 0) {
		redirect(303, resolve(`/panel/posts/${postId}/${translations[0].languageCode}`));
	}

	return {
		post: {
			id: post.id,
			ownerName: post.ownerName,
			hiddenByModerator: post.hiddenByModerator,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt
		},
		translations,
		languages: listContentLanguages(db)
	};
};
