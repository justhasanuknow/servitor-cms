import { API_PREFIX, CORS_MAX_AGE_SECONDS } from '../../constants/api';
import { reportSecurityEvent } from '../security/security-events';
import { ApiError, apiErrorResponse } from './api-errors';

const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';

const ALLOWED_HEADERS = 'Authorization, If-None-Match, If-Modified-Since';

const LOGGED_ORIGIN_MAX_LENGTH = 200;

const EXPOSED_HEADERS =
	'ETag, Last-Modified, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After';

export function isApiPath(pathname: string): boolean {
	return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

export function isReadMethod(method: string): boolean {
	return method === 'GET' || method === 'HEAD';
}

export function preflightResponse(
	allowedOrigin: string | null,
	requestOrigin: string | null = null
): Response {
	const headers = new Headers({ Vary: 'Origin' });

	if (allowedOrigin === null) {
		if (requestOrigin !== null) {
			reportSecurityEvent({
				type: 'cors_origin_rejected',
				origin: requestOrigin.slice(0, LOGGED_ORIGIN_MAX_LENGTH)
			});
		}

		return new Response(null, { status: 403, headers });
	}

	headers.set('Access-Control-Allow-Origin', allowedOrigin);
	headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
	headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
	headers.set('Access-Control-Max-Age', String(CORS_MAX_AGE_SECONDS));

	return new Response(null, { status: 204, headers });
}

export function methodNotAllowedResponse(): Response {
	return apiErrorResponse(
		new ApiError(405, 'method_not_allowed', 'The API only answers GET requests.', {
			Allow: ALLOWED_METHODS
		})
	);
}

export function applyCorsHeaders(headers: Headers, allowedOrigin: string | null): void {
	headers.append('Vary', 'Origin');

	if (allowedOrigin === null) {
		return;
	}

	headers.set('Access-Control-Allow-Origin', allowedOrigin);
	headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS);
}
