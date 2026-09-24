import { error } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages';
import { blogTagPath } from '$lib/public/paths';
import { termListing } from '$lib/server/public/listing-page';
import { findPublicTag } from '$lib/server/public/public-posts';
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
	const tag = findPublicTag(runtime.db, language.code, slugParam(params.slug));

	if (tag === null) {
		error(404, { message: 'Not found' });
	}

	return termListing(
		runtime,
		{
			siteName: settings.siteName,
			language,
			heading: m.public_tag_title({ name: tag.name }),
			path: blogTagPath(language.code, tag.slug),
			page: pageParam(url)
		},
		{ tagId: tag.id }
	);
};
