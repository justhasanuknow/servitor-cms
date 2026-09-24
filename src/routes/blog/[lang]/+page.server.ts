import { error } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages';
import { blogIndexPath } from '$lib/public/paths';
import { defaultLanguageCode } from '$lib/server/languages/languages';
import { listPublicLanguages, listPublicPosts } from '$lib/server/public/public-posts';
import { pageParam, publicLanguageParam, requirePublicSite } from '$lib/server/public/public-site';
import { languageIndexPaths, listingSeo } from '$lib/server/public/seo';
import { getRuntime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const { db, env } = getRuntime();
	const settings = requirePublicSite(db);
	const language = publicLanguageParam(db, params.lang);
	const page = pageParam(url);
	const listing = listPublicPosts(db, language.code, page);

	if (listing === null) {
		error(404, { message: 'Not found' });
	}

	let documentTitle = settings.siteName;

	if (page > 1) {
		documentTitle = m.public_page_title({ title: settings.siteName, page: String(page) });
	}

	return {
		listing,
		seo: listingSeo({
			origin: env.ORIGIN,
			siteName: settings.siteName,
			defaultLanguage: defaultLanguageCode(db),
			languageCode: language.code,
			documentTitle,
			title: settings.siteName,
			description: m.public_feed_description({
				site: settings.siteName,
				language: language.nativeName
			}),
			path: blogIndexPath(language.code),
			page,
			pageCount: listing.pageCount,
			feedTitle: `${settings.siteName} · ${language.nativeName}`,
			translatedPaths: languageIndexPaths(listPublicLanguages(db).map((entry) => entry.code))
		})
	};
};
