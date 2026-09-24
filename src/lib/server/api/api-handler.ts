import type { RequestEvent } from '@sveltejs/kit';
import { API_RATE_LIMIT_WINDOW_MS } from '../../constants/api';
import { defaultLanguageCode } from '../languages/languages';
import { listPublicLanguages } from '../public/public-posts';
import type { Runtime } from '../runtime.interfaces';
import { loadSystemSettings } from '../settings/system-settings';
import { ApiError, apiErrorResponse } from './api-errors';
import { authenticateApiKey } from './api-keys';
import type { ApiKeyContext } from './api-keys.interfaces';
import { rejectKeyInQuery } from './api-query';
import type { ApiRequestContext } from './api.interfaces';

const BEARER_PATTERN = /^Bearer[ ]+(\S+)[ ]*$/i;

const AUTHENTICATE_HEADER = 'Bearer realm="Servitor API"';

function authenticate(runtime: Runtime, header: string | null): ApiKeyContext {
	if (header === null) {
		throw new ApiError(401, 'unauthorized', 'Send an API key in the Authorization header.', {
			'WWW-Authenticate': AUTHENTICATE_HEADER
		});
	}

	const match = BEARER_PATTERN.exec(header);
	let key: ApiKeyContext | null = null;

	if (match !== null) {
		key = authenticateApiKey(runtime.db, match[1]);
	}

	if (key === null) {
		throw new ApiError(401, 'unauthorized', 'The API key is not valid.', {
			'WWW-Authenticate': `${AUTHENTICATE_HEADER}, error="invalid_token"`
		});
	}

	return key;
}

export function apiContext(runtime: Runtime, key: ApiKeyContext): ApiRequestContext {
	const settings = loadSystemSettings(runtime.db);

	return {
		db: runtime.db,
		origin: runtime.env.ORIGIN,
		key,
		publicSiteEnabled: settings.publicSiteEnabled,
		defaultLanguage: defaultLanguageCode(runtime.db),
		languages: listPublicLanguages(runtime.db).filter(
			(language) => key.languages === null || key.languages.includes(language.code)
		)
	};
}

export function handleApiRequest(
	runtime: Runtime,
	event: Pick<RequestEvent, 'request' | 'url' | 'locals'>,
	respond: (context: ApiRequestContext, headers: Headers) => Response
): Response {
	const headers = new Headers();

	try {
		rejectKeyInQuery(event.url);

		const key = authenticate(runtime, event.request.headers.get('authorization'));
		const limit = key.rateLimitPerMinute ?? loadSystemSettings(runtime.db).defaultApiRateLimit;
		const decision = runtime.rateLimiter.consume(`api:${key.id}`, {
			windowMs: API_RATE_LIMIT_WINDOW_MS,
			max: limit
		});

		headers.set('RateLimit-Limit', String(limit));
		headers.set('RateLimit-Remaining', String(decision.remaining));
		headers.set('RateLimit-Reset', String(decision.resetSeconds));

		if (!decision.allowed) {
			throw new ApiError(429, 'rate_limited', 'Too many requests. Try again later.', {
				'Retry-After': String(decision.retryAfterSeconds)
			});
		}

		return respond(apiContext(runtime, key), headers);
	} catch (error) {
		if (error instanceof ApiError) {
			return apiErrorResponse(error, headers);
		}

		runtime.logger.error(
			{ err: error, requestId: event.locals.requestId },
			'The API request failed'
		);

		return apiErrorResponse(
			new ApiError(500, 'internal_error', 'The request could not be completed.'),
			headers
		);
	}
}

export function languageInScope(context: ApiRequestContext, value: string): string | null {
	const lower = value.toLowerCase();

	return (
		context.languages.find((language) => language.code.toLowerCase() === lower)?.code ?? null
	);
}
