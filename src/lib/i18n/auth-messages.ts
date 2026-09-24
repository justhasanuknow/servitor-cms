import { m } from '$lib/paraglide/messages';

export function reauthenticationMessage(error: string | undefined): string | null {
	switch (error) {
		case 'invalid_password':
			return m.reauth_invalid_password();
		case 'missing_code':
			return m.reauth_missing_code();
		case 'invalid_code':
			return m.reauth_invalid_code();
		case 'rate_limited':
			return m.common_rate_limited_generic();
		case 'invalid_input':
			return m.common_invalid_input();
		default:
			return null;
	}
}

export function newPasswordMessage(error: string | undefined): string | null {
	switch (error) {
		case 'too_short':
			return m.password_too_short();
		case 'too_long':
			return m.password_too_long();
		case 'too_common':
			return m.password_too_common();
		case 'reused':
			return m.password_reused();
		case 'mismatch':
			return m.password_mismatch();
		case 'invalid_link':
			return m.link_invalid();
		default:
			return reauthenticationMessage(error);
	}
}

export function rateLimitMessage(retryAfterSeconds: number): string {
	return m.common_rate_limited({ seconds: String(Math.max(1, retryAfterSeconds)) });
}

export function emailChangeMessage(error: string | undefined): string | null {
	switch (error) {
		case 'email_taken':
			return m.profile_email_error_taken();
		case 'unchanged':
			return m.profile_email_error_unchanged();
		case 'email_failed':
			return m.profile_email_error_send();
		default:
			return reauthenticationMessage(error);
	}
}
