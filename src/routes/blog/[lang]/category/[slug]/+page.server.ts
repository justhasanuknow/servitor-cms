import { error } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages';
import { blogCategoryPath } from '$lib/public/paths';
import { termListing } from '$lib/server/public/listing-page';
import { findPublicCategory } from '$lib/server/public/public-posts';
import {
	pageParam,
	publicLanguageParam,
	requirePublicSite,
	slugParam
} from '$lib/server/public/public-site';
import { getRuntime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const runtime = getRuntime();
	const settings = requirePublicSite(runtime.db);
	const language = publicLanguageParam(runtime.db, params.lang);
	const category = findPublicCategory(runtime.db, language.code, slugParam(params.slug));

	if (category === null) {
		error(404, { message: 'Not found' });
	}

	return termListing(
		runtime,
		{
			siteName: settings.siteName,
			language,
			heading: m.public_category_title({ name: category.name }),
			path: blogCategoryPath(language.code, category.slug),
			page: pageParam(url)
		},
		{ categoryId: category.id }
	);
};
