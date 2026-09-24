import { m } from '$lib/paraglide/messages';
import { reauthenticationMessage } from './auth-messages';

export function categoryErrorMessage(
	error: string | undefined,
	languageCode: string | null | undefined
): string | null {
	const language = languageCode ?? '';

	switch (error) {
		case 'missing_default_name':
			return m.categories_error_missing_default();
		case 'unknown_language':
			return m.categories_error_unknown_language({ code: language });
		case 'invalid_slug':
			return m.categories_error_invalid_slug({ code: language });
		case 'slug_taken':
			return m.categories_error_slug_taken({ code: language });
		case 'in_use':
			return m.categories_error_in_use();
		case 'not_found':
			return m.categories_error_not_found();
		default:
			return reauthenticationMessage(error);
	}
}
