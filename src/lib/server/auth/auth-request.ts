import type { RequestEvent } from '@sveltejs/kit';
import { requestMetadata } from '../http/client-address';
import { authCookieHeader } from './auth-cookies';
import type { AuthRequest } from './auth-request.interfaces';

export const CLIENT_IP_HEADER = 'x-servitor-client-ip';

export function createAuthRequest(event: RequestEvent): AuthRequest {
	const metadata = requestMetadata(event);

	return {
		headers: authRequestHeaders(
			event.request.headers,
			metadata.ip,
			event.url.protocol === 'https:'
		),
		ip: metadata.ip,
		userAgent: metadata.userAgent
	};
}

export function authRequestHeaders(source: Headers, ip: string | null, secure: boolean): Headers {
	const headers = new Headers(source);
	const cookie = headers.get('cookie');

	headers.delete(CLIENT_IP_HEADER);

	if (ip !== null) {
		headers.set(CLIENT_IP_HEADER, ip);
	}

	if (cookie !== null) {
		headers.set('cookie', authCookieHeader(cookie, secure));
	}

	return headers;
}
