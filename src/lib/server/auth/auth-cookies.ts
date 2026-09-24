import { HOST_COOKIE_PREFIX, SECURE_COOKIE_PREFIX } from 'better-auth/cookies';

export const AUTH_COOKIE_PREFIX = 'servitor';

const PLAIN_AUTH_PREFIX = `${AUTH_COOKIE_PREFIX}.`;

const SECURE_AUTH_PREFIX = `${SECURE_COOKIE_PREFIX}${PLAIN_AUTH_PREFIX}`;

const HOST_AUTH_PREFIX = `${HOST_COOKIE_PREFIX}${PLAIN_AUTH_PREFIX}`;

export function isSecureAuthCookie(name: string): boolean {
	return name.startsWith(SECURE_AUTH_PREFIX);
}

export function browserCookieName(authCookieName: string): string {
	if (isSecureAuthCookie(authCookieName)) {
		return `${HOST_AUTH_PREFIX}${authCookieName.slice(SECURE_AUTH_PREFIX.length)}`;
	}

	return authCookieName;
}

export function authCookieHeader(cookieHeader: string, secure: boolean): string {
	if (!secure) {
		return cookieHeader;
	}

	const pairs: string[] = [];

	for (const chunk of cookieHeader.split(';')) {
		const pair = chunk.trim();

		if (pair.startsWith(HOST_AUTH_PREFIX)) {
			pairs.push(`${SECURE_AUTH_PREFIX}${pair.slice(HOST_AUTH_PREFIX.length)}`);
		} else if (pair !== '' && !isUntrustedAuthCookie(pair)) {
			pairs.push(pair);
		}
	}

	return pairs.join('; ');
}

function isUntrustedAuthCookie(pair: string): boolean {
	return pair.startsWith(SECURE_AUTH_PREFIX) || pair.startsWith(PLAIN_AUTH_PREFIX);
}
