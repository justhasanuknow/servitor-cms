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

export function rateLimitMessage(retryAfterSeconds: number): string {
	return m.common_rate_limited({ seconds: String(Math.max(1, retryAfterSeconds)) });
}
