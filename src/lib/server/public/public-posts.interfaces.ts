export interface PublicListFilter {
	categoryId?: string;
	tagId?: string;
}

export interface PublicTermRecord {
	id: string;
	name: string;
	slug: string;
}

export interface PostViewSource {
	translationId: string;
	postId: string;
	languageCode: string;
	revisionId: string;
	slug: string;
	publishedAt: Date | null;
}

export interface PublicFeedItem {
	translationId: string;
	slug: string;
	publishedAt: Date | null;
	title: string;
	excerpt: string;
	contentHtml: string;
	authorName: string;
}

export interface PublicSitemapEntry {
	slug: string;
	modifiedAt: Date;
}
