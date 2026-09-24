import type { PublicPostView } from '../../modules/interfaces/public.interfaces';

export interface PostSeoInput {
	origin: string;
	siteName: string;
	defaultLanguage: string | null;
	post: PublicPostView;
	feedTitle: string;
	robots: string | null;
}

export interface TranslatedPath {
	languageCode: string;
	path: string;
}

export interface ListingSeoInput {
	origin: string;
	siteName: string;
	defaultLanguage: string | null;
	languageCode: string;
	documentTitle: string;
	title: string;
	description: string;
	path: string;
	page: number;
	pageCount: number;
	feedTitle: string;
	translatedPaths: TranslatedPath[] | null;
}
