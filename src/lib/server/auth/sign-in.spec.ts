import { desc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, session, twoFactor, user } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { onSecurityEvent } from '../security/security-events';
import type { SecurityEvent } from '../security/security-events.interfaces';
import { createTestRuntime } from '../testing/runtime';
import { generateTotp, nextTotp } from '../testing/totp';
import { signInWithPassword, verifySignInCode } from './sign-in';
import { confirmTwoFactorEnrollment, startTwoFactorEnrollment } from './two-factor-settings';

const EMAIL = 'author@example.com';

const PASSWORD = 'Kx7-quiet-harbor-19';

const WRONG_PASSWORD = 'Kx7-wrong-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(() => {
	harness = createTestRuntime();
});

afterEach(() => {
	harness.dispose();
});

function auditEntries(action: string) {
	return harness.runtime.db.select().from(auditLog).where(eq(auditLog.action, action)).all();
}

function signIn(jar: TestCookieJar, ip: string, email: string, password: string) {
	return signInWithPassword(harness.runtime, harness.request(jar, ip), { email, password });
}

async function enrollTwoFactor(): Promise<{ secret: string; backupCodes: string[] }> {
	const jar = new TestCookieJar();

	await signIn(jar, '192.0.2.1', EMAIL, PASSWORD);

	const current = await harness.currentSession(jar);
	const started = await startTwoFactorEnrollment(
		harness.runtime,
		harness.request(jar, '192.0.2.1'),
		current.user,
		PASSWORD
	);

	if (started.status !== 'started') {
		throw new Error(`Enrollment did not start: ${started.status}`);
	}

	const confirmed = await confirmTwoFactorEnrollment(
		harness.runtime,
		harness.request(jar, '192.0.2.1'),
		current.user,
		generateTotp(started.enrollment.secret)
	);

	expect(confirmed).toBe('enabled');

	return started.enrollment;
}

describe('signInWithPassword', () => {
	it('signs in with valid credentials and records the login', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const jar = new TestCookieJar();

		expect(await signIn(jar, '198.51.100.7', EMAIL, PASSWORD)).toEqual({ status: 'signed_in' });

		const current = await harness.currentSession(jar);
		const latest = harness.runtime.db
			.select()
			.from(auditLog)
			.orderBy(desc(auditLog.createdAt))
			.get();

		expect(current.user.id).toBe(userId);
		expect(latest).toMatchObject({
			actorType: 'user',
			actorId: userId,
			action: 'auth.login_succeeded',
			ip: '198.51.100.7'
		});
	});

	it('answers a wrong password and an unknown email identically', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const wrongPassword = await signIn(
			new TestCookieJar(),
			'198.51.100.1',
			EMAIL,
			WRONG_PASSWORD
		);
		const unknownEmail = await signIn(
			new TestCookieJar(),
			'198.51.100.2',
			'nobody@example.com',
			PASSWORD
		);

		expect(wrongPassword).toEqual({ status: 'invalid_credentials' });
		expect(unknownEmail).toEqual(wrongPassword);
		expect(auditEntries('auth.login_failed')).toMatchObject([
			{ actorType: 'anonymous', targetType: 'user', targetId: userId },
			{ actorType: 'anonymous', targetType: null, targetId: null }
		]);
		expect(harness.runtime.db.select().from(session).all()).toHaveLength(0);
	});

	it('locks an account for every address after ten failures', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });

		for (let attempt = 1; attempt < 10; attempt += 1) {
			expect(
				await signIn(new TestCookieJar(), `198.51.100.${attempt}`, EMAIL, WRONG_PASSWORD)
			).toEqual({ status: 'invalid_credentials' });
		}

		expect(await signIn(new TestCookieJar(), '198.51.100.10', EMAIL, WRONG_PASSWORD)).toEqual({
			status: 'locked'
		});
		expect(await signIn(new TestCookieJar(), '198.51.100.11', EMAIL, PASSWORD)).toEqual({
			status: 'locked'
		});
		expect(auditEntries('auth.account_locked')).toMatchObject([
			{ targetType: 'user', targetId: userId, details: { stage: 'password' } }
		]);
		expect(harness.runtime.db.select().from(session).all()).toHaveLength(0);
	});

	it('locks unknown emails the same way', async () => {
		for (let attempt = 1; attempt < 10; attempt += 1) {
			await signIn(
				new TestCookieJar(),
				`203.0.113.${attempt}`,
				'ghost@example.com',
				PASSWORD
			);
		}

		expect(
			await signIn(new TestCookieJar(), '203.0.113.10', 'ghost@example.com', PASSWORD)
		).toEqual({ status: 'locked' });
	});

	it('limits sign-in attempts per address', async () => {
		await harness.createUser({ email: EMAIL, password: PASSWORD });

		for (let attempt = 0; attempt < 3; attempt += 1) {
			await signIn(new TestCookieJar(), '198.51.100.50', EMAIL, WRONG_PASSWORD);
		}

		const limited = await signIn(new TestCookieJar(), '198.51.100.50', EMAIL, PASSWORD);

		expect(limited.status).toBe('rate_limited');
		expect(limited).toHaveProperty('retryAfterSeconds');
	});

	it('refuses deactivated users even with the right password', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });

		harness.runtime.db
			.update(user)
			.set({ deactivatedAt: new Date() })
			.where(eq(user.id, userId))
			.run();

		expect(await signIn(new TestCookieJar(), '198.51.100.3', EMAIL, PASSWORD)).toEqual({
			status: 'invalid_credentials'
		});
		expect(harness.runtime.db.select().from(session).all()).toHaveLength(0);
	});
});

describe('verifySignInCode', () => {
	it('accepts an authenticator code only once', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const { secret } = await enrollTwoFactor();
		const events: SecurityEvent[] = [];
		const stop = onSecurityEvent((event) => events.push(event));
		const jar = new TestCookieJar();

		try {
			expect(await signIn(jar, '198.51.100.30', EMAIL, PASSWORD)).toEqual({
				status: 'two_factor_required'
			});
			expect(
				await verifySignInCode(harness.runtime, harness.request(jar, '198.51.100.30'), {
					method: 'totp',
					code: generateTotp(secret)
				})
			).toEqual({ status: 'invalid_code' });
			expect(events).toContainEqual({ type: 'totp_reused', userId });
			expect(auditEntries('auth.login_failed').at(-1)).toMatchObject({
				targetId: userId,
				details: { stage: 'two_factor', method: 'totp', reason: 'invalid_code' }
			});
			expect(
				await verifySignInCode(harness.runtime, harness.request(jar, '198.51.100.30'), {
					method: 'totp',
					code: nextTotp(secret)
				})
			).toEqual({ status: 'signed_in' });
		} finally {
			stop();
		}
	});

	it('asks for a second factor and accepts a valid authenticator code', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const { secret } = await enrollTwoFactor();
		const jar = new TestCookieJar();

		expect(await signIn(jar, '198.51.100.20', EMAIL, PASSWORD)).toEqual({
			status: 'two_factor_required'
		});
		expect(
			await harness.runtime.auth.api.getSession({
				headers: harness.request(jar, '198.51.100.20').headers
			})
		).toBeNull();
		expect(
			await verifySignInCode(harness.runtime, harness.request(jar, '198.51.100.21'), {
				method: 'totp',
				code: nextTotp(secret)
			})
		).toEqual({ status: 'signed_in' });
		expect((await harness.currentSession(jar)).user.id).toBe(userId);
		expect(auditEntries('auth.login_succeeded').at(-1)).toMatchObject({
			actorId: userId,
			details: { method: 'totp' }
		});
	});

	it('rejects a wrong code and accepts each backup code only once', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const { backupCodes } = await enrollTwoFactor();
		const first = new TestCookieJar();

		await signIn(first, '198.51.100.30', EMAIL, PASSWORD);

		expect(
			await verifySignInCode(harness.runtime, harness.request(first, '198.51.100.31'), {
				method: 'totp',
				code: '000000'
			})
		).toEqual({ status: 'invalid_code' });
		expect(auditEntries('auth.login_failed').at(-1)).toMatchObject({
			targetId: userId,
			details: { stage: 'two_factor', reason: 'invalid_code' }
		});
		expect(
			await verifySignInCode(harness.runtime, harness.request(first, '198.51.100.32'), {
				method: 'backup_code',
				code: backupCodes[0]
			})
		).toEqual({ status: 'signed_in' });

		const second = new TestCookieJar();

		await signIn(second, '198.51.100.33', EMAIL, PASSWORD);

		expect(
			await verifySignInCode(harness.runtime, harness.request(second, '198.51.100.34'), {
				method: 'backup_code',
				code: backupCodes[0]
			})
		).toEqual({ status: 'invalid_code' });
	});

	it('stores backup codes only as hashes', async () => {
		await harness.createUser({ email: EMAIL, password: PASSWORD });

		const { backupCodes } = await enrollTwoFactor();
		const stored = harness.runtime.db.select().from(twoFactor).get();

		expect(backupCodes).toHaveLength(10);
		expect(stored?.backupCodes).toBeDefined();

		for (const code of backupCodes) {
			expect(stored?.backupCodes).not.toContain(code);
		}
	});

	it('reports an expired challenge when no sign-in is pending', async () => {
		expect(
			await verifySignInCode(harness.runtime, harness.request(new TestCookieJar()), {
				method: 'totp',
				code: '123456'
			})
		).toEqual({ status: 'challenge_expired' });
	});
});
