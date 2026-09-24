export interface ContentLanguageView {
	code: string;
	name: string;
	nativeName: string;
	enabled: boolean;
	isDefault: boolean;
	sortOrder: number;
	translationCount: number;
}

export interface NewLanguageInput {
	code: string;
	name: string | null;
	nativeName: string | null;
	sortOrder: number;
}

export interface LanguageUpdateInput {
	name: string;
	nativeName: string;
	sortOrder: number;
}

export type AddLanguageResult =
	{ status: 'added'; code: string } | { status: 'invalid_code' } | { status: 'exists' };

export type LanguageChangeResult = 'updated' | 'unchanged' | 'not_found' | 'default_language';

export type LanguageDeleteResult = 'deleted' | 'not_found' | 'default_language' | 'in_use';
