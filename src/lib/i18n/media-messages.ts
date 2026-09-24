import { m } from '$lib/paraglide/messages';

export function mediaErrorMessage(error: string | undefined): string | null {
	switch (error) {
		case undefined:
			return null;
		case 'empty':
			return m.media_error_empty();
		case 'too_large':
			return m.media_error_too_large();
		case 'unsupported_type':
			return m.media_error_unsupported_type();
		case 'invalid_image':
			return m.media_error_invalid_image();
		case 'too_many_pixels':
			return m.media_error_too_many_pixels();
		case 'in_use':
			return m.media_error_in_use();
		case 'not_found':
			return m.media_error_not_found();
		case 'unknown_language':
			return m.media_error_unknown_language();
		default:
			return m.media_error_generic();
	}
}
