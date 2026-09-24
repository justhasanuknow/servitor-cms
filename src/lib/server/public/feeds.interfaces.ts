export interface RssChannel {
	title: string;
	link: string;
	description: string;
	language: string;
	selfUrl: string;
	lastBuildDate: Date | null;
}

export interface RssItem {
	title: string;
	link: string;
	guid: string;
	publishedAt: Date | null;
	description: string;
	contentHtml: string;
	author: string;
}

export interface SitemapEntry {
	loc: string;
	lastmod: Date | null;
}
