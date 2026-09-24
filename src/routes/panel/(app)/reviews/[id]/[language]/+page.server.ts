import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { requireActor } from '$lib/server/auth/actor';
import { readFormFields } from '$lib/server/http/form';
import { listContentLanguages } from '$lib/server/languages/languages';
import { languageParam, postIdParam } from '$lib/server/posts/post-form';
import { getRuntime } from '$lib/server/runtime';
import { loadReview } from '$lib/server/workflow/reviews';
import { MAX_REVIEW_NOTE_LENGTH, reviewSubmission } from '$lib/server/workflow/workflow';
import type { ReviewDecision } from '$lib/server/workflow/workflow.interfaces';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const decisionSchema = z.object({
	revisionId: z.uuid(),
	note: z.string().max(MAX_REVIEW_NOTE_LENGTH).optional()
});

export const load: PageServerLoad = ({ locals, params }) => {
	const { user } = requireActor(locals);
	const postId = postIdParam(params.id);
	const languageCode = languageParam(params.language);
	const runtime = getRuntime();
	const review = loadReview(runtime, user, postId, languageCode);

	if (review === null) {
		error(404, { message: 'Not found' });
	}

	return { review, languages: listContentLanguages(runtime.db) };
};

async function decide(event: RequestEvent, decision: ReviewDecision) {
	const { user } = requireActor(event.locals);
	const postId = postIdParam(event.params.id);
	const languageCode = languageParam(event.params.language);
	const form = decisionSchema.safeParse(await readFormFields(event.request));

	if (!form.success) {
		return fail(400, { error: 'invalid_input' as const });
	}

	const result = reviewSubmission(
		getRuntime(),
		createAuthRequest(event),
		user,
		postId,
		languageCode,
		form.data.revisionId,
		decision,
		form.data.note ?? null
	);

	if (result === 'not_found') {
		error(404, { message: 'Not found' });
	}

	if (result !== 'approved' && result !== 'rejected') {
		return fail(400, { error: result });
	}

	redirect(303, `${resolve('/panel/reviews')}?decided=${result}`);
}

export const actions: Actions = {
	approve: (event) => decide(event, 'approve'),
	reject: (event) => decide(event, 'reject')
};
