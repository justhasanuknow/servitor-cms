export type DocsSectionId = 'start' | 'operate' | 'use' | 'integrate' | 'reference';

export type DocsPath = '/docs' | `/docs/${string}`;

export interface DocsHeading {
	id: string;
	text: string;
	depth: number;
}

export interface RenderedDocs {
	title: string;
	html: string;
	headings: DocsHeading[];
}

export interface DocsPage extends RenderedDocs {
	slug: string | null;
	path: DocsPath;
}

export interface DocsPageLink {
	slug: string | null;
	path: DocsPath;
	title: string;
}

export interface DocsSection {
	id: DocsSectionId;
	pages: DocsPageLink[];
}

export interface DocsPageView {
	page: DocsPage;
	previous: DocsPageLink | null;
	next: DocsPageLink | null;
}
