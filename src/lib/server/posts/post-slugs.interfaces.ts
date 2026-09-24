export interface PostSlugRequest {
	translationId: string;
	languageCode: string;
	requested: string;
	title: string;
	generate: boolean;
}

export type PostSlugResult =
	{ status: 'ok'; slug: string } | { status: 'invalid_slug' } | { status: 'slug_taken' };
