import { m } from '$lib/paraglide/messages';
import { reauthenticationMessage } from './auth-messages';

export function apiKeyErrorMessage(error: string | undefined): string | null {
	switch (error) {
		case 'languages_required':
			return m.api_keys_error_languages();
		case 'categories_required':
			return m.api_keys_error_categories();
		case 'invalid_expiry':
			return m.api_keys_error_expiry();
		case 'unknown_language':
		case 'unknown_category':
			return m.api_keys_error_unknown();
		case 'already_revoked':
			return m.api_keys_error_state();
		default:
			return reauthenticationMessage(error);
	}
}

export function apiKeyStatusLabel(status: string): string {
	switch (status) {
		case 'revoked':
			return m.api_keys_status_revoked();
		case 'expired':
			return m.api_keys_status_expired();
		default:
			return m.api_keys_status_active();
	}
}

export function corsErrorMessage(error: string | undefined): string | null {
	switch (error) {
		case undefined:
			return null;
		case 'invalid_origin':
			return m.cors_error_invalid();
		case 'exists':
			return m.cors_error_exists();
		case 'too_many':
			return m.cors_error_too_many();
		default:
			return m.common_invalid_input();
	}
}
