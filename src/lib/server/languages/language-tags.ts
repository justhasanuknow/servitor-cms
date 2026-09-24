import type { LanguageNames } from './language-tags.interfaces';

export const MAX_LANGUAGE_TAG_LENGTH = 35;

const LANGUAGE_TAG_CHARACTERS = /^[A-Za-z0-9-]+$/;

const PRIMARY_LANGUAGE_SUBTAG = /^[a-z]{2,3}$/;

export function canonicalLanguageTag(value: string): string | null {
	const trimmed = value.trim();

	if (
		trimmed === '' ||
		trimmed.length > MAX_LANGUAGE_TAG_LENGTH ||
		!LANGUAGE_TAG_CHARACTERS.test(trimmed)
	) {
		return null;
	}

	try {
		const [canonical] = Intl.getCanonicalLocales(trimmed);

		if (
			canonical === undefined ||
			canonical === 'und' ||
			!PRIMARY_LANGUAGE_SUBTAG.test(baseLanguage(canonical))
		) {
			return null;
		}

		return canonical;
	} catch {
		return null;
	}
}

export function isLanguageTag(value: string): boolean {
	return canonicalLanguageTag(value) !== null;
}

export function baseLanguage(code: string): string {
	return code.split('-')[0].toLowerCase();
}

export function suggestLanguageNames(code: string): LanguageNames {
	return {
		name: displayName('en', code) ?? code,
		nativeName: displayName(code, code) ?? code
	};
}

function displayName(locale: string, code: string): string | undefined {
	try {
		return new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }).of(code);
	} catch {
		return undefined;
	}
}
