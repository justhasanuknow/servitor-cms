import { requireActor } from '$lib/server/auth/actor';
import { listContentLanguages } from '$lib/server/languages/languages';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import { listReviewQueue } from '$lib/server/workflow/reviews';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'review.list', null);

	const { db } = getRuntime();

	return {
		queue: listReviewQueue(db, user),
		languages: listContentLanguages(db)
	};
};
