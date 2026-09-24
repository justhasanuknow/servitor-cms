import { absoluteUrl, blogIndexPath, blogPostPath } from '$lib/public/paths';
import { buildUrlSet, XML_CONTENT_TYPE } from '$lib/server/public/feeds';
import { listSitemapEntries } from '$lib/server/public/public-posts';
import { publicLanguageParam, requirePublicSite } from '$lib/server/public/public-site';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const { db, env } = getRuntime();

	requirePublicSite(db);

	const language = publicLanguageParam(db, params.lang);
	const posts = listSitemapEntries(db, language.code);
	const body = buildUrlSet([
		{
			loc: absoluteUrl(env.ORIGIN, blogIndexPath(language.code)),
			lastmod: posts[0]?.modifiedAt ?? null
		},
		...posts.map((post) => ({
			loc: absoluteUrl(env.ORIGIN, blogPostPath(language.code, post.slug)),
			lastmod: post.modifiedAt
		}))
	]);

	return new Response(body, { headers: { 'Content-Type': XML_CONTENT_TYPE } });
};
