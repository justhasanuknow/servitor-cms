import { isAPIError } from 'better-auth/api';

export function authErrorCode(error: unknown): string | null {
	if (!isAPIError(error)) {
		return null;
	}

	const code = error.body?.code;

	if (typeof code === 'string') {
		return code;
	}

	return null;
}
