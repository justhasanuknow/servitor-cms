import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { requireActor } from '$lib/server/auth/actor';
import { readFormFields } from '$lib/server/http/form';
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
import { hidePost, MAX_HIDE_REASON_LENGTH, unhidePost } from '$lib/server/workflow/moderation';
import type { Actions, PageServerLoad } from './$types';

const hideSchema = z.object({ reason: z.string().max(MAX_HIDE_REASON_LENGTH) });

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
			hiddenReason: post.hiddenReason,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt
		},
		canModerate: can(user, 'post.moderate', postSubject(post)),
		translations,
		languages: listContentLanguages(db)
	};
};

export const actions: Actions = {
	hide: async (event) => {
		const { user } = requireActor(event.locals);
		const form = hideSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = hidePost(
			getRuntime(),
			createAuthRequest(event),
			user,
			postIdParam(event.params.id),
			form.data.reason
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result !== 'hidden') {
			return fail(400, { error: result });
		}

		return { moderated: result };
	},
	unhide: (event) => {
		const { user } = requireActor(event.locals);
		const result = unhidePost(
			getRuntime(),
			createAuthRequest(event),
			user,
			postIdParam(event.params.id)
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result !== 'unhidden') {
			return fail(400, { error: result });
		}

		return { moderated: result };
	}
};
