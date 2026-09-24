import slugify from '@sindresorhus/slugify';
import { baseLanguage } from '../languages/language-tags';

export const MAX_SLUG_LENGTH = 120;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SHORT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const SHORT_ID_LENGTH = 10;

export function slugFromText(text: string, languageCode: string): string {
	const slug = slugify(text, { decamelize: false, locale: baseLanguage(languageCode) });

	return trimSlug(slug);
}

export function slugOrShortId(text: string, languageCode: string): string {
	const slug = slugFromText(text, languageCode);

	if (slug !== '') {
		return slug;
	}

	return shortSlugId();
}

export function shortSlugId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(SHORT_ID_LENGTH));

	return [...bytes].map((byte) => SHORT_ID_ALPHABET[byte % SHORT_ID_ALPHABET.length]).join('');
}

export function isValidSlug(slug: string): boolean {
	return slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

export function withNumericSuffix(slug: string, attempt: number): string {
	const suffix = `-${attempt}`;

	return `${trimSlug(slug.slice(0, MAX_SLUG_LENGTH - suffix.length))}${suffix}`;
}

function trimSlug(slug: string): string {
	return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
}
