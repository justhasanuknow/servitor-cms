export interface PublicLanguage {
	code: string;
	name: string;
	nativeName: string;
	isDefault: boolean;
}

export interface PublicImage {
	id: string;
	width: number;
	height: number;
	alt: string;
}

export interface PublicTerm {
	name: string;
	slug: string;
}

export interface PublicAlternate {
	languageCode: string;
	nativeName: string;
	slug: string;
}

export interface PublicPostSummary {
	translationId: string;
	languageCode: string;
	slug: string;
	title: string;
	excerpt: string;
	authorName: string;
	publishedAt: Date | null;
	readingTimeMinutes: number;
	cover: PublicImage | null;
}

export interface PublicPostPage {
	items: PublicPostSummary[];
	page: number;
	pageCount: number;
	total: number;
}

export interface PublicPostView {
	translationId: string;
	postId: string;
	languageCode: string;
	slug: string;
	title: string;
	excerpt: string;
	metaTitle: string | null;
	metaDescription: string | null;
	contentHtml: string;
	readingTimeMinutes: number;
	publishedAt: Date | null;
	modifiedAt: Date;
	authorName: string;
	category: PublicTerm | null;
	tags: PublicTerm[];
	cover: PublicImage | null;
	ogImage: PublicImage | null;
	alternates: PublicAlternate[];
}

export interface SeoAlternate {
	hreflang: string;
	href: string;
}

export interface SeoImage {
	url: string;
	width: number;
	height: number;
	alt: string;
}

export interface SeoFeed {
	title: string;
	href: string;
}

export interface PublicSeo {
	documentTitle: string;
	title: string;
	description: string;
	canonical: string;
	robots: string | null;
	alternates: SeoAlternate[];
	type: 'website' | 'article';
	siteName: string;
	locale: string;
	image: SeoImage | null;
	publishedTime: string | null;
	modifiedTime: string | null;
	feed: SeoFeed | null;
	previous: string | null;
	next: string | null;
	jsonLd: string | null;
}
