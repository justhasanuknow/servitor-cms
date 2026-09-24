import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '../auth/auth';
import { auditLog } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import {
	addCorsOrigin,
	isAllowedOrigin,
	listCorsOrigins,
	normalizeOrigin,
	removeCorsOrigin
} from './cors';
import {
	applyCorsHeaders,
	isApiPath,
	methodNotAllowedResponse,
	preflightResponse
} from './cors-headers';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

let admin: AuthUser;

let author: AuthUser;

beforeEach(async () => {
	harness = createTestRuntime();
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD });
	admin = (await harness.signIn('admin@example.com', PASSWORD)).actor;
	author = (await harness.signIn('author@example.com', PASSWORD)).actor;
});

afterEach(() => {
	harness.dispose();
});

function request() {
	return harness.request(new TestCookieJar());
}

describe('origin normalization', () => {
	it.each([
		['https://www.example.com', 'https://www.example.com'],
		['  https://Example.COM/ ', 'https://example.com'],
		['http://localhost:5173', 'http://localhost:5173'],
		['https://example.com:443', 'https://example.com']
	])('accepts %s', (value, expected) => {
		expect(normalizeOrigin(value)).toBe(expected);
	});

	it.each([
		'*',
		'https://*.example.com',
		'example.com',
		'ftp://example.com',
		'https://example.com/path',
		'https://example.com?x=1',
		'https://example.com#top',
		'https://user:pass@example.com',
		'null',
		''
	])('rejects %s', (value) => {
		expect(normalizeOrigin(value)).toBeNull();
	});
});

describe('allowlist management', () => {
	it('adds, matches exactly and removes origins with audit entries', () => {
		expect(addCorsOrigin(harness.runtime, request(), admin, 'https://www.example.com/')).toBe(
			'added'
		);
		expect(addCorsOrigin(harness.runtime, request(), admin, 'https://WWW.example.com')).toBe(
			'exists'
		);
		expect(addCorsOrigin(harness.runtime, request(), admin, 'https://example.com/x')).toBe(
			'invalid_origin'
		);

		expect(isAllowedOrigin(harness.runtime.db, 'https://www.example.com')).toBe(
			'https://www.example.com'
		);
		expect(isAllowedOrigin(harness.runtime.db, 'http://www.example.com')).toBeNull();
		expect(isAllowedOrigin(harness.runtime.db, 'https://www.example.com:8443')).toBeNull();
		expect(isAllowedOrigin(harness.runtime.db, 'https://evil.example.com')).toBeNull();
		expect(isAllowedOrigin(harness.runtime.db, 'null')).toBeNull();
		expect(isAllowedOrigin(harness.runtime.db, null)).toBeNull();

		const [entry] = listCorsOrigins(harness.runtime.db);

		expect(removeCorsOrigin(harness.runtime, request(), admin, entry.id)).toBe('removed');
		expect(removeCorsOrigin(harness.runtime, request(), admin, entry.id)).toBe('not_found');
		expect(isAllowedOrigin(harness.runtime.db, 'https://www.example.com')).toBeNull();
		expect(
			harness.runtime.db
				.select({ action: auditLog.action })
				.from(auditLog)
				.where(eq(auditLog.targetType, 'cors_origin'))
				.all()
				.map((row) => row.action)
		).toEqual(['cors.origin_added', 'cors.origin_removed']);
	});

	it('is limited to staff', () => {
		expect(() =>
			addCorsOrigin(harness.runtime, request(), author, 'https://www.example.com')
		).toThrow(expect.objectContaining({ status: 403 }));
	});
});

describe('CORS headers', () => {
	it('only applies to the API', () => {
		expect(isApiPath('/api/v1')).toBe(true);
		expect(isApiPath('/api/v1/posts')).toBe(true);
		expect(isApiPath('/api/v10')).toBe(false);
		expect(isApiPath('/panel/api-keys')).toBe(false);
	});

	it('answers preflight requests only for allowed origins', () => {
		const allowed = preflightResponse('https://www.example.com');

		expect(allowed.status).toBe(204);
		expect(allowed.headers.get('access-control-allow-origin')).toBe('https://www.example.com');
		expect(allowed.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
		expect(allowed.headers.get('access-control-allow-headers')).toContain('Authorization');
		expect(allowed.headers.has('access-control-allow-credentials')).toBe(false);

		const refused = preflightResponse(null);

		expect(refused.status).toBe(403);
		expect(refused.headers.has('access-control-allow-origin')).toBe(false);
	});

	it('adds the allowed origin to responses and never credentials', () => {
		const allowed = new Headers({ Vary: 'Authorization' });
		const refused = new Headers();

		applyCorsHeaders(allowed, 'https://www.example.com');
		applyCorsHeaders(refused, null);

		expect(allowed.get('access-control-allow-origin')).toBe('https://www.example.com');
		expect(allowed.get('access-control-expose-headers')).toContain('ETag');
		expect(allowed.get('vary')).toBe('Authorization, Origin');
		expect(allowed.has('access-control-allow-credentials')).toBe(false);
		expect(refused.has('access-control-allow-origin')).toBe(false);
		expect(refused.get('vary')).toBe('Origin');
	});

	it('refuses methods other than GET with the error shape', async () => {
		const response = methodNotAllowedResponse();

		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
		expect(await response.json()).toMatchObject({ error: { code: 'method_not_allowed' } });
	});
});
