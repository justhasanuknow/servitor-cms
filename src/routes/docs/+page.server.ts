import { readDocsIndex } from '$lib/server/docs/docs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { view: readDocsIndex() };
};
