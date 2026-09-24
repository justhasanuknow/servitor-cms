export interface CategoryFieldLanguage {
	code: string;
	name: string;
	nativeName: string;
	enabled: boolean;
}

export interface CategoryFieldValue {
	languageCode: string;
	name: string;
	slug: string;
}

export interface CategoryFieldsProps {
	languages: CategoryFieldLanguage[];
	defaultLanguage: string | null;
	values: CategoryFieldValue[];
	idPrefix: string;
}
