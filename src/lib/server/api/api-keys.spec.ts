import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '../auth/auth';
import { apiKeys, auditLog } from '../db/schema';
import { ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import type { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import {
	authenticateApiKey,
	createApiKey,
	generateApiKey,
	hashApiKey,
	listApiKeys,
	revokeApiKey
} from './api-keys';
import type { ApiKeyInput } from './api-keys.interfaces';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

let admin: AuthUser;

let author: AuthUser;

let adminJar: TestCookieJar;

let authorJar: TestCookieJar;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD });
	const adminSession = await harness.signIn('admin@example.com', PASSWORD);
	const authorSession = await harness.signIn('author@example.com', PASSWORD);

	admin = adminSession.actor;
	adminJar = adminSession.jar;
	author = authorSession.actor;
	authorJar = authorSession.jar;
});

afterEach(() => {
	harness.dispose();
});

function request(jar: TestCookieJar = adminJar) {
	return harness.request(jar);
}

const INPUT: ApiKeyInput = {
	name: 'Website',
	languages: null,
	categories: null,
	expiresAt: null,
	rateLimitPerMinute: null
};

async function created(input: ApiKeyInput = INPUT) {
	const result = await createApiKey(harness.runtime, request(), admin, input, {
		password: PASSWORD,
		totpCode: null
	});

	if (result.status !== 'created') {
		throw new Error(`Expected a new key, got ${result.status}`);
	}

	return result;
}

describe('key format', () => {
	it('uses the svt_ prefix and 32 random bytes', () => {
		const key = generateApiKey();

		expect(key).toMatch(/^svt_[A-Za-z0-9_-]{43}$/);
		expect(generateApiKey()).not.toBe(key);
	});
});

describe('creating keys', () => {
	it('stores only a hash and a short prefix, and returns the key once', async () => {
		const result = await created();
		const row = harness.runtime.db
			.select()
			.from(apiKeys)
			.where(eq(apiKeys.id, result.id))
			.get();

		expect(row?.keyHash).toBe(hashApiKey(result.key));
		expect(row?.keyPrefix).toBe(result.key.slice(0, 12));
		expect(JSON.stringify(row)).not.toContain(result.key);
		expect(listApiKeys(harness.runtime.db)[0]).toMatchObject({
			name: 'Website',
			status: 'active',
			languages: null,
			categories: null
		});
		expect(
			harness.runtime.db
				.select({ action: auditLog.action, details: auditLog.details })
				.from(auditLog)
				.where(eq(auditLog.action, 'api_key.created'))
				.get()
		).toMatchObject({ details: { name: 'Website', prefix: result.key.slice(0, 12) } });
	});

	it('requires the current password', async () => {
		expect(
			await createApiKey(harness.runtime, request(), admin, INPUT, {
				password: 'wrong-password-123',
				totpCode: null
			})
		).toEqual({ status: 'invalid_password' });
	});

	it('rejects past expiry dates and unknown scopes', async () => {
		const confirmation = { password: PASSWORD, totpCode: null };

		expect(
			await createApiKey(
				harness.runtime,
				request(),
				admin,
				{ ...INPUT, expiresAt: new Date(Date.now() - 1000) },
				confirmation
			)
		).toEqual({ status: 'invalid_expiry' });
		expect(
			await createApiKey(
				harness.runtime,
				request(),
				admin,
				{ ...INPUT, languages: ['xx'] },
				confirmation
			)
		).toEqual({ status: 'unknown_language' });
		expect(
			await createApiKey(
				harness.runtime,
				request(),
				admin,
				{ ...INPUT, categories: [crypto.randomUUID()] },
				confirmation
			)
		).toEqual({ status: 'unknown_category' });
	});

	it('is limited to staff', async () => {
		await expect(
			createApiKey(harness.runtime, request(authorJar), author, INPUT, {
				password: PASSWORD,
				totpCode: null
			})
		).rejects.toMatchObject({ status: 403 });
	});
});

describe('authenticating keys', () => {
	it('accepts active keys with their scope and records the last use', async () => {
		const result = await created({ ...INPUT, languages: ['en'] });
		const context = authenticateApiKey(harness.runtime.db, result.key);

		expect(context).toEqual({
			id: result.id,
			rateLimitPerMinute: null,
			languages: ['en'],
			categories: null
		});
		expect(listApiKeys(harness.runtime.db)[0].lastUsedAt).not.toBeNull();
	});

	it('refuses unknown, altered, expired and revoked keys', async () => {
		const result = await created({ ...INPUT, expiresAt: new Date(Date.now() + 60_000) });

		expect(authenticateApiKey(harness.runtime.db, generateApiKey())).toBeNull();
		expect(authenticateApiKey(harness.runtime.db, `${result.key}x`)).toBeNull();
		expect(
			authenticateApiKey(harness.runtime.db, result.key.replace('svt_', 'abc_'))
		).toBeNull();
		expect(
			authenticateApiKey(harness.runtime.db, result.key, new Date(Date.now() + 120_000))
		).toBeNull();

		expect(
			await revokeApiKey(harness.runtime, request(), admin, result.id, {
				password: PASSWORD,
				totpCode: null
			})
		).toBe('revoked');
		expect(authenticateApiKey(harness.runtime.db, result.key)).toBeNull();
		expect(listApiKeys(harness.runtime.db)[0].status).toBe('revoked');
	});

	it('requires the password to revoke and records the revocation', async () => {
		const result = await created();

		expect(
			await revokeApiKey(harness.runtime, request(), admin, result.id, {
				password: 'wrong-password-123',
				totpCode: null
			})
		).toBe('invalid_password');
		expect(authenticateApiKey(harness.runtime.db, result.key)).not.toBeNull();

		await revokeApiKey(harness.runtime, request(), admin, result.id, {
			password: PASSWORD,
			totpCode: null
		});
		harness.advanceClock(10_000);

		expect(
			await revokeApiKey(harness.runtime, request(), admin, result.id, {
				password: PASSWORD,
				totpCode: null
			})
		).toBe('already_revoked');
		expect(
			harness.runtime.db
				.select({ action: auditLog.action })
				.from(auditLog)
				.where(eq(auditLog.action, 'api_key.revoked'))
				.all()
		).toHaveLength(1);
	});
});
