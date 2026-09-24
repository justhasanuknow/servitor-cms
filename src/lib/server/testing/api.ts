import { apiKeyPrefix, generateApiKey, hashApiKey } from '../api/api-keys';
import type { DatabaseExecutor } from '../db';
import { apiKeyCategories, apiKeyLanguages, apiKeys } from '../db/schema';
import type { TestApiKeyOptions } from './api.interfaces';

export function insertTestApiKey(
	db: DatabaseExecutor,
	createdBy: string,
	options: TestApiKeyOptions = {}
): { id: string; key: string } {
	const key = generateApiKey();
	const id = crypto.randomUUID();

	db.insert(apiKeys)
		.values({
			id,
			name: options.name ?? 'Test key',
			keyPrefix: apiKeyPrefix(key),
			keyHash: hashApiKey(key),
			allLanguages: options.languages === undefined,
			allCategories: options.categories === undefined,
			rateLimitPerMinute: options.rateLimitPerMinute ?? null,
			expiresAt: options.expiresAt ?? null,
			revokedAt: options.revokedAt ?? null,
			createdBy
		})
		.run();

	for (const languageCode of options.languages ?? []) {
		db.insert(apiKeyLanguages).values({ apiKeyId: id, languageCode }).run();
	}

	for (const categoryId of options.categories ?? []) {
		db.insert(apiKeyCategories).values({ apiKeyId: id, categoryId }).run();
	}

	return { id, key };
}

export function apiRequest(path: string, key: string | null, headers: Record<string, string> = {}) {
	const url = new URL(`http://localhost:4173/api/v1${path}`);
	const requestHeaders = new Headers(headers);

	if (key !== null) {
		requestHeaders.set('authorization', `Bearer ${key}`);
	}

	return {
		url,
		request: new Request(url, { headers: requestHeaders }),
		locals: { requestId: 'test', user: null, session: null, preferences: null }
	};
}
