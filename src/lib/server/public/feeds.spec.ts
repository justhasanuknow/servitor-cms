import { describe, expect, it } from 'vitest';
import { buildRssFeed, buildSitemapIndex, buildUrlSet } from './feeds';
import { absolutizeUrls, escapeXml } from './xml';

const CHANNEL = {
	title: 'Field Notes · English',
	link: 'https://cms.example.com/blog/en',
	description: 'Latest posts',
	language: 'en',
	selfUrl: 'https://cms.example.com/blog/en/rss.xml',
	lastBuildDate: new Date('2026-09-01T10:00:00.000Z')
};

describe('XML escaping', () => {
	it('escapes markup characters and drops characters XML cannot hold', () => {
		expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;'
		);
		expect(escapeXml(`bell${String.fromCodePoint(7)} and \uD800 lone surrogate 😀`)).toBe(
			'bell and  lone surrogate 😀'
		);
	});

	it('turns relative addresses in content into absolute ones', () => {
		expect(
			absolutizeUrls(
				'<p><a href="/blog/en/other">a</a><a href="#top">b</a><a href="mailto:x@example.com">c</a><img src="/media/x/1600.webp"></p>',
				'https://cms.example.com/blog/en/post'
			)
		).toBe(
			'<p><a href="https://cms.example.com/blog/en/other">a</a><a href="https://cms.example.com/blog/en/post#top">b</a><a href="mailto:x@example.com">c</a><img src="https://cms.example.com/media/x/1600.webp"></p>'
		);
	});
});

describe('RSS feed', () => {
	it('lists items with escaped text and full content', () => {
		const feed = buildRssFeed(CHANNEL, [
			{
				title: 'Cats & <dogs>',
				link: 'https://cms.example.com/blog/en/cats',
				guid: 'urn:uuid:1',
				publishedAt: new Date('2026-09-01T10:00:00.000Z'),
				description: 'Short',
				contentHtml: '<p>Body <img src="/media/x/1600.webp"></p>',
				author: 'Ada'
			}
		]);

		expect(feed).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(feed).toContain('<title>Cats &amp; &lt;dogs&gt;</title>');
		expect(feed).toContain('<pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate>');
		expect(feed).toContain('<guid isPermaLink="false">urn:uuid:1</guid>');
		expect(feed).toContain('<dc:creator>Ada</dc:creator>');
		expect(feed).toContain(
			'<content:encoded>&lt;p&gt;Body &lt;img src=&quot;https://cms.example.com/media/x/1600.webp&quot;&gt;&lt;/p&gt;</content:encoded>'
		);
		expect(feed).toContain(
			'<atom:link href="https://cms.example.com/blog/en/rss.xml" rel="self" type="application/rss+xml"/>'
		);
	});

	it('works without items', () => {
		const feed = buildRssFeed({ ...CHANNEL, lastBuildDate: null }, []);

		expect(feed).not.toContain('<item>');
		expect(feed).not.toContain('lastBuildDate');
	});
});

describe('sitemaps', () => {
	it('builds a sitemap index and URL sets', () => {
		expect(
			buildSitemapIndex([
				{ loc: 'https://cms.example.com/blog/en/sitemap.xml', lastmod: null }
			])
		).toContain('<sitemap><loc>https://cms.example.com/blog/en/sitemap.xml</loc></sitemap>');
		expect(
			buildUrlSet([
				{
					loc: 'https://cms.example.com/blog/en/a?b&c',
					lastmod: new Date('2026-09-01T10:00:00.000Z')
				}
			])
		).toContain(
			'<url><loc>https://cms.example.com/blog/en/a?b&amp;c</loc><lastmod>2026-09-01T10:00:00.000Z</lastmod></url>'
		);
	});
});
