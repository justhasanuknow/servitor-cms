import { listPublicLanguages } from '$lib/server/public/public-posts';
import { publicLanguageParam, requirePublicSite } from '$lib/server/public/public-site';
import { getRuntime } from '$lib/server/runtime';
import type { LayoutServerLoad } from './$types';

export const csr = false;

export const load: LayoutServerLoad = ({ params }) => {
	const { db } = getRuntime();
	const settings = requirePublicSite(db);

	return {
		siteName: settings.siteName,
		language: publicLanguageParam(db, params.lang),
		languages: listPublicLanguages(db)
	};
};
