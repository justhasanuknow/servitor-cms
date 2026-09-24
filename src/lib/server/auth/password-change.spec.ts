import { verifyPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, auditLog, session, user } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import { generateTotp } from '../testing/totp';
import { changeOwnPassword } from './password-change';
import { signInWithPassword } from './sign-in';
import { confirmTwoFactorEnrollment, startTwoFactorEnrollment } from './two-factor-settings';

const EMAIL = 'founder@example.com';

const PASSWORD = 'Kx7-quiet-harbor-19';

const NEW_PASSWORD = 'lantern-orchard-seventeen';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(() => {
	harness = createTestRuntime();
});

afterEach(() => {
	harness.dispose();
});

async function signedInJar(ip: string): Promise<TestCookieJar> {
	const jar = new TestCookieJar();
	const result = await signInWithPassword(harness.runtime, harness.request(jar, ip), {
		email: EMAIL,
		password: PASSWORD
	});

	expect(result).toEqual({ status: 'signed_in' });

	return jar;
}

async function storedPasswordMatches(userId: string, password: string): Promise<boolean> {
	const credential = harness.runtime.db
		.select()
		.from(account)
		.where(eq(account.userId, userId))
		.get();

	return verifyPassword({ hash: credential?.password ?? '', password });
}

describe('changeOwnPassword', () => {
	it('changes the password, clears the forced change and revokes every other session', async () => {
		const userId = await harness.createUser({
			email: EMAIL,
			password: PASSWORD,
			role: 'founder',
			mustChangePassword: true
		});
		const other = await signedInJar('198.51.100.1');
		const jar = await signedInJar('198.51.100.2');
		const current = await harness.currentSession(jar);

		expect(
			await changeOwnPassword(harness.runtime, harness.request(jar), current.user, {
				currentPassword: PASSWORD,
				newPassword: NEW_PASSWORD,
				totpCode: null
			})
		).toBe('changed');

		const sessions = harness.runtime.db.select().from(session).all();

		expect(await storedPasswordMatches(userId, NEW_PASSWORD)).toBe(true);
		expect(sessions).toHaveLength(1);
		expect(sessions[0].id).not.toBe(current.session.id);
		expect((await harness.currentSession(jar)).user.id).toBe(userId);
		expect(
			await harness.runtime.auth.api.getSession({ headers: harness.request(other).headers })
		).toBeNull();
		expect(
			harness.runtime.db.select().from(user).where(eq(user.id, userId)).get()
		).toMatchObject({ mustChangePassword: false });
		expect(
			harness.runtime.db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, 'auth.password_changed'))
				.all()
		).toMatchObject([{ actorId: userId, targetId: userId }]);
	});

	it.each([
		['short-pass', 'too_short'],
		['Unbelievable', 'too_common'],
		[PASSWORD, 'reused']
	])('rejects %s as the new password', async (newPassword, expected) => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const jar = await signedInJar('198.51.100.3');
		const current = await harness.currentSession(jar);

		expect(
			await changeOwnPassword(harness.runtime, harness.request(jar), current.user, {
				currentPassword: PASSWORD,
				newPassword,
				totpCode: null
			})
		).toBe(expected);
		expect(await storedPasswordMatches(userId, PASSWORD)).toBe(true);
	});

	it('requires the current password', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const jar = await signedInJar('198.51.100.4');
		const current = await harness.currentSession(jar);

		expect(
			await changeOwnPassword(harness.runtime, harness.request(jar), current.user, {
				currentPassword: 'not-the-current-password',
				newPassword: NEW_PASSWORD,
				totpCode: null
			})
		).toBe('invalid_password');
		expect(await storedPasswordMatches(userId, PASSWORD)).toBe(true);
		expect(harness.runtime.db.select().from(session).all()).toHaveLength(1);
	});

	it('requires an authenticator code when two-factor authentication is on', async () => {
		const userId = await harness.createUser({ email: EMAIL, password: PASSWORD });
		const jar = await signedInJar('198.51.100.5');
		const started = await startTwoFactorEnrollment(
			harness.runtime,
			harness.request(jar, '198.51.100.5'),
			(await harness.currentSession(jar)).user,
			PASSWORD
		);

		if (started.status !== 'started') {
			throw new Error('Enrollment did not start');
		}

		await confirmTwoFactorEnrollment(
			harness.runtime,
			harness.request(jar, '198.51.100.5'),
			(await harness.currentSession(jar)).user,
			generateTotp(started.enrollment.secret)
		);

		const actor = (await harness.currentSession(jar)).user;

		expect(
			await changeOwnPassword(harness.runtime, harness.request(jar, '198.51.100.6'), actor, {
				currentPassword: PASSWORD,
				newPassword: NEW_PASSWORD,
				totpCode: null
			})
		).toBe('missing_code');
		expect(
			await changeOwnPassword(harness.runtime, harness.request(jar, '198.51.100.7'), actor, {
				currentPassword: PASSWORD,
				newPassword: NEW_PASSWORD,
				totpCode: '000000'
			})
		).toBe('invalid_code');
		expect(await storedPasswordMatches(userId, PASSWORD)).toBe(true);

		harness.advanceClock(10_000);

		expect(
			await changeOwnPassword(harness.runtime, harness.request(jar, '198.51.100.8'), actor, {
				currentPassword: PASSWORD,
				newPassword: NEW_PASSWORD,
				totpCode: generateTotp(started.enrollment.secret)
			})
		).toBe('changed');
	});

	it('limits repeated re-authentication attempts', async () => {
		await harness.createUser({ email: EMAIL, password: PASSWORD });

		const jar = await signedInJar('198.51.100.9');
		const actor = (await harness.currentSession(jar)).user;
		const results: string[] = [];

		for (let attempt = 0; attempt < 4; attempt += 1) {
			results.push(
				await changeOwnPassword(
					harness.runtime,
					harness.request(jar, `198.51.100.${20 + attempt}`),
					actor,
					{
						currentPassword: 'wrong-password-123',
						newPassword: NEW_PASSWORD,
						totpCode: null
					}
				)
			);
		}

		expect(results).toEqual([
			'invalid_password',
			'invalid_password',
			'invalid_password',
			'rate_limited'
		]);
	});
});
