export interface RenderedContent {
	json: string;
	html: string;
	text: string;
	readingTimeMinutes: number;
	mediaIds: string[];
}

export type ContentRenderResult =
	| { status: 'rendered'; content: RenderedContent }
	| { status: 'invalid' }
	| { status: 'too_large' };
