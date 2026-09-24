import { common, createLowlight } from 'lowlight';
import { MAX_CODE_LANGUAGE_LENGTH } from '../constants/content';

const LANGUAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9_+#.-]*$/i;

export const lowlight = createLowlight(common);

export const CODE_LANGUAGES: readonly string[] = [...lowlight.listLanguages()].sort();

export function isCodeLanguage(value: string): boolean {
	return (
		value.length <= MAX_CODE_LANGUAGE_LENGTH &&
		LANGUAGE_NAME_PATTERN.test(value) &&
		lowlight.registered(value)
	);
}
