export interface PostEventTranslation {
	languageCode: string;
	slug: string | null;
}

export interface PostEventTarget {
	postId: string;
	translations: PostEventTranslation[];
}
