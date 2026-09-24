import { z } from 'zod';
import { MAX_MEDIA_ALT_TEXT_LENGTH } from '../../constants/media';
import type { ContentLanguageView } from '../languages/languages.interfaces';
import type { MediaAltTextInput, MediaItemView } from './media-library.interfaces';

const MAX_PAGE = 100_000;

const pageSchema = z.coerce.number().int().min(1).max(MAX_PAGE);

const idSchema = z.uuid();

const altTextSchema = z.string().max(MAX_MEDIA_ALT_TEXT_LENGTH);

export function readPageNumber(value: string | null): number {
	const parsed = pageSchema.safeParse(value ?? undefined);

	if (!parsed.success) {
		return 1;
	}

	return parsed.data;
}

export function readMediaId(value: string | undefined): string | null {
	const parsed = idSchema.safeParse(value);

	if (!parsed.success) {
		return null;
	}

	return parsed.data;
}

export function readAltTexts(
	fields: Record<string, string | undefined>,
	languages: ContentLanguageView[]
): MediaAltTextInput[] | null {
	const entries: MediaAltTextInput[] = [];

	for (const language of languages) {
		const parsed = altTextSchema.safeParse(fields[`alt:${language.code}`] ?? '');

		if (!parsed.success) {
			return null;
		}

		entries.push({ languageCode: language.code, altText: parsed.data });
	}

	return entries;
}

export function altTextFor(
	item: MediaItemView,
	languageCode: string,
	defaultLanguage: string | null
): string {
	const own = item.altTexts[languageCode];

	if (own !== undefined) {
		return own;
	}

	if (defaultLanguage !== null) {
		return item.altTexts[defaultLanguage] ?? '';
	}

	return '';
}
