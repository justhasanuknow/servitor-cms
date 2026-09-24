export interface RevisionPayload {
	title: string;
	slug: string;
	excerpt: string;
	metaTitle: string | null;
	metaDescription: string | null;
	ogMediaId: string | null;
	contentJson: string;
	contentHtml: string;
	contentText: string;
	readingTimeMinutes: number;
	tags: string[];
	mediaIds: string[];
}

export interface TranslationPointers {
	id: string;
	workingRevisionId: string | null;
	pendingRevisionId: string | null;
	liveRevisionId: string | null;
}
