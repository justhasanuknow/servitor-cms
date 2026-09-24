import { m } from '$lib/paraglide/messages';
import { absoluteUrl, blogFeedPath, blogIndexPath, blogPostPath } from '$lib/public/paths';
import { buildRssFeed, RSS_CONTENT_TYPE } from '$lib/server/public/feeds';
import { listFeedItems } from '$lib/server/public/public-posts';
import { publicLanguageParam, requirePublicSite } from '$lib/server/public/public-site';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const { db, env } = getRuntime();
	const settings = requirePublicSite(db);
	const language = publicLanguageParam(db, params.lang);
	const items = listFeedItems(db, language.code);
	const body = buildRssFeed(
		{
			title: `${settings.siteName} · ${language.nativeName}`,
			link: absoluteUrl(env.ORIGIN, blogIndexPath(language.code)),
			description: m.public_feed_description({
				site: settings.siteName,
				language: language.nativeName
			}),
			language: language.code,
			selfUrl: absoluteUrl(env.ORIGIN, blogFeedPath(language.code)),
			lastBuildDate: items[0]?.publishedAt ?? null
		},
		items.map((item) => ({
			title: item.title,
			link: absoluteUrl(env.ORIGIN, blogPostPath(language.code, item.slug)),
			guid: `urn:uuid:${item.translationId}`,
			publishedAt: item.publishedAt,
			description: item.excerpt,
			contentHtml: item.contentHtml,
			author: item.authorName
		}))
	);

	return new Response(body, { headers: { 'Content-Type': RSS_CONTENT_TYPE } });
};
