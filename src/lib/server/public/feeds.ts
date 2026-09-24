import type { RssChannel, RssItem, SitemapEntry } from './feeds.interfaces';
import { absolutizeUrls, escapeXml } from './xml';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

export const RSS_CONTENT_TYPE = 'application/rss+xml; charset=utf-8';

export const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';

function element(name: string, value: string): string {
	return `<${name}>${escapeXml(value)}</${name}>`;
}

function optionalDate(name: string, value: Date | null, format: (date: Date) => string): string {
	if (value === null) {
		return '';
	}

	return element(name, format(value));
}

function rssDate(date: Date): string {
	return date.toUTCString();
}

function isoDate(date: Date): string {
	return date.toISOString();
}

function rssItem(item: RssItem): string {
	return [
		'<item>',
		element('title', item.title),
		element('link', item.link),
		`<guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
		optionalDate('pubDate', item.publishedAt, rssDate),
		element('dc:creator', item.author),
		element('description', item.description),
		element('content:encoded', absolutizeUrls(item.contentHtml, item.link)),
		'</item>'
	].join('');
}

export function buildRssFeed(channel: RssChannel, items: RssItem[]): string {
	return [
		XML_DECLARATION,
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
		'<channel>',
		element('title', channel.title),
		element('link', channel.link),
		element('description', channel.description),
		element('language', channel.language),
		optionalDate('lastBuildDate', channel.lastBuildDate, rssDate),
		`<atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>`,
		...items.map(rssItem),
		'</channel>',
		'</rss>'
	].join('\n');
}

function sitemapEntry(tag: string, entry: SitemapEntry): string {
	return `<${tag}>${element('loc', entry.loc)}${optionalDate('lastmod', entry.lastmod, isoDate)}</${tag}>`;
}

export function buildSitemapIndex(entries: SitemapEntry[]): string {
	return [
		XML_DECLARATION,
		`<sitemapindex xmlns="${SITEMAP_NAMESPACE}">`,
		...entries.map((entry) => sitemapEntry('sitemap', entry)),
		'</sitemapindex>'
	].join('\n');
}

export function buildUrlSet(entries: SitemapEntry[]): string {
	return [
		XML_DECLARATION,
		`<urlset xmlns="${SITEMAP_NAMESPACE}">`,
		...entries.map((entry) => sitemapEntry('url', entry)),
		'</urlset>'
	].join('\n');
}
