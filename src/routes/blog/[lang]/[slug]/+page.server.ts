import { error } from '@sveltejs/kit';
import { defaultLanguageCode } from '$lib/server/languages/languages';
import { findPublicPost } from '$lib/server/public/public-posts';
import { publicLanguageParam, requirePublicSite, slugParam } from '$lib/server/public/public-site';
import { postSeo } from '$lib/server/public/seo';
import { getRuntime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const { db, env } = getRuntime();
	const settings = requirePublicSite(db);
	const language = publicLanguageParam(db, params.lang);
	const post = findPublicPost(db, language.code, slugParam(params.slug));

	if (post === null) {
		error(404, { message: 'Not found' });
	}

	return {
		post,
		seo: postSeo({
			origin: env.ORIGIN,
			siteName: settings.siteName,
			defaultLanguage: defaultLanguageCode(db),
			post,
			feedTitle: `${settings.siteName} · ${language.nativeName}`,
			robots: null
		})
	};
};
