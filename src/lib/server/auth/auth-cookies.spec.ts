import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import { authCookieHeader, browserCookieName } from './auth-cookies';
import { signOut } from './sessions';

const EMAIL = 'author@example.com';

const PASSWORD = 'Kx7-quiet-harbor-19';

const SESSION_COOKIE = 'servitor.session_token';

const SECURE_SESSION_COOKIE = '__Secure-servitor.session_token';

const HOST_SESSION_COOKIE = '__Host-servitor.session_token';

describe('browserCookieName', () => {
	it('stores secure auth cookies under the __Host- prefix', () => {
		expect(browserCookieName(SECURE_SESSION_COOKIE)).toBe(HOST_SESSION_COOKIE);
		expect(browserCookieName('__Secure-servitor.two_factor')).toBe(
			'__Host-servitor.two_factor'
		);
	});

	it('keeps plain development cookies and foreign cookies unchanged', () => {
		expect(browserCookieName(SESSION_COOKIE)).toBe(SESSION_COOKIE);
		expect(browserCookieName('__Secure-other.session_token')).toBe(
			'__Secure-other.session_token'
		);
	});
});

describe('authCookieHeader', () => {
	it('passes the header through unchanged without HTTPS', () => {
		const header = `${SESSION_COOKIE}=abc; theme=dark`;

		expect(authCookieHeader(header, false)).toBe(header);
	});

	it('translates __Host- auth cookies for Better Auth over HTTPS', () => {
		expect(authCookieHeader(`${HOST_SESSION_COOKIE}=abc.def%3D; other=1`, true)).toBe(
			`${SECURE_SESSION_COOKIE}=abc.def%3D; other=1`
		);
	});

	it('drops auth cookies that do not carry the __Host- prefix over HTTPS', () => {
		const header = [
			`${SECURE_SESSION_COOKIE}=injected`,
			`${SESSION_COOKIE}=plain`,
			'__Host-servitor_locale=tr',
			`${HOST_SESSION_COOKIE}=trusted`
		].join(';');

		expect(authCookieHeader(header, true)).toBe(
			`__Host-servitor_locale=tr; ${SECURE_SESSION_COOKIE}=trusted`
		);
	});
});

describe('auth cookies over HTTPS', () => {
	let harness: ReturnType<typeof createTestRuntime>;

	beforeEach(async () => {
		harness = createTestRuntime({ origin: 'https://cms.example.test' });
		await harness.createUser({ email: EMAIL, password: PASSWORD });
	});

	afterEach(() => {
		harness.dispose();
	});

	it('keeps the session in a __Host- cookie that the next request can use', async () => {
		const { jar } = await harness.signIn(EMAIL, PASSWORD);

		expect(jar.names()).toContain(HOST_SESSION_COOKIE);
		expect(jar.names().filter((name) => !name.startsWith('__Host-'))).toEqual([]);
		expect((await harness.currentSession(jar)).user.email).toBe(EMAIL);
	});

	it('ignores a session token sent under a cookie name a subdomain could set', async () => {
		const { jar } = await harness.signIn(EMAIL, PASSWORD);
		const token = jar.get(HOST_SESSION_COOKIE) ?? '';

		for (const name of [SECURE_SESSION_COOKIE, SESSION_COOKIE]) {
			const forged = new TestCookieJar();

			forged.set(name, decodeURIComponent(token), { path: '/' });

			await expect(harness.currentSession(forged)).rejects.toThrow(
				'Expected an active session'
			);
		}
	});

	it('clears the __Host- session cookie on sign-out', async () => {
		const { jar, actor } = await harness.signIn(EMAIL, PASSWORD);

		await signOut(harness.runtime, harness.request(jar), actor);

		expect(jar.has(HOST_SESSION_COOKIE)).toBe(false);
	});
});
