import { error } from '@sveltejs/kit';
import { readDocsPage } from '$lib/server/docs/docs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const view = readDocsPage(params.slug);

	if (view === null) {
		error(404, { message: 'Not found' });
	}

	return { view };
};
