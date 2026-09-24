import { z } from 'zod';
import { MAX_SLUG_LENGTH } from '../content/slugs';
import type { ContentLanguageView } from '../languages/languages.interfaces';
import type { CategoryTranslationInput } from './categories.interfaces';

export const CATEGORY_NAME_MAX_LENGTH = 100;

const translationSchema = z.object({
	name: z.string().trim().max(CATEGORY_NAME_MAX_LENGTH),
	slug: z.string().trim().max(MAX_SLUG_LENGTH)
});

export function readCategoryTranslations(
	fields: Record<string, string | undefined>,
	languages: ContentLanguageView[]
): CategoryTranslationInput[] | null {
	const translations: CategoryTranslationInput[] = [];

	for (const language of languages) {
		const parsed = translationSchema.safeParse({
			name: fields[`name:${language.code}`] ?? '',
			slug: fields[`slug:${language.code}`] ?? ''
		});

		if (!parsed.success) {
			return null;
		}

		let slug: string | null = null;

		if (parsed.data.slug !== '') {
			slug = parsed.data.slug;
		}

		translations.push({ languageCode: language.code, name: parsed.data.name, slug });
	}

	return translations;
}
