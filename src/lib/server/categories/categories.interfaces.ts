export interface CategoryTranslationInput {
	languageCode: string;
	name: string;
	slug: string | null;
}

export interface CategoryTranslationView {
	languageCode: string;
	name: string;
	slug: string;
}

export interface CategoryView {
	id: string;
	translations: CategoryTranslationView[];
	postCount: number;
	createdAt: Date;
}

export type CategorySaveResult =
	| { status: 'saved'; id: string }
	| { status: 'not_found' }
	| { status: 'missing_default_name' }
	| { status: 'unknown_language'; languageCode: string }
	| { status: 'invalid_slug'; languageCode: string }
	| { status: 'slug_taken'; languageCode: string };

export type CategoryDeleteResult = 'deleted' | 'not_found' | 'in_use';

export type SlugResolution =
	{ status: 'ok'; slug: string } | { status: 'invalid_slug' | 'slug_taken' };
