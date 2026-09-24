import { absoluteUrl, blogSitemapPath } from '$lib/public/paths';
import { buildSitemapIndex, XML_CONTENT_TYPE } from '$lib/server/public/feeds';
import { listPublicLanguages } from '$lib/server/public/public-posts';
import { requirePublicSite } from '$lib/server/public/public-site';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const { db, env } = getRuntime();

	requirePublicSite(db);

	const body = buildSitemapIndex(
		listPublicLanguages(db).map((language) => ({
			loc: absoluteUrl(env.ORIGIN, blogSitemapPath(language.code)),
			lastmod: null
		}))
	);

	return new Response(body, { headers: { 'Content-Type': XML_CONTENT_TYPE } });
};
