import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, session, twoFactor, user } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import { generateTotp, secretFromTotpUri } from '../testing/totp';
import { signInWithPassword, verifySignInCode } from './sign-in';
import {
	confirmTwoFactorEnrollment,
	countRemainingBackupCodes,
	disableTwoFactor,
	regenerateBackupCodes,
	startTwoFactorEnrollment
} from './two-factor-settings';

const EMAIL = 'admin@example.com';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

let userId: string;

beforeEach(async () => {
	harness = createTestRuntime();
	userId = await harness.createUser({ email: EMAIL, password: PASSWORD, role: 'admin' });
});

afterEach(() => {
	harness.dispose();
});

async function signedInJar(ip: string): Promise<TestCookieJar> {
	const jar = new TestCookieJar();

	await signInWithPassword(harness.runtime, harness.request(jar, ip), {
		email: EMAIL,
		password: PASSWORD
	});

	return jar;
}

async function actorOf(jar: TestCookieJar) {
	return (await harness.currentSession(jar)).user;
}

async function enable(jar: TestCookieJar): Promise<{ secret: string; backupCodes: string[] }> {
	const started = await startTwoFactorEnrollment(
		harness.runtime,
		harness.request(jar, '192.0.2.10'),
		await actorOf(jar),
		PASSWORD
	);

	if (started.status !== 'started') {
		throw new Error(`Enrollment did not start: ${started.status}`);
	}

	expect(
		await confirmTwoFactorEnrollment(
			harness.runtime,
			harness.request(jar, '192.0.2.11'),
			await actorOf(jar),
			generateTotp(started.enrollment.secret)
		)
	).toBe('enabled');

	return started.enrollment;
}

function actions(): string[] {
	return harness.runtime.db
		.select({ action: auditLog.action })
		.from(auditLog)
		.all()
		.map((row) => row.action);
}

describe('two-factor enrollment', () => {
	it('starts with a secret and ten backup codes and turns on after a valid code', async () => {
		const jar = await signedInJar('198.51.100.1');
		const started = await startTwoFactorEnrollment(
			harness.runtime,
			harness.request(jar),
			await actorOf(jar),
			PASSWORD
		);

		if (started.status !== 'started') {
			throw new Error('Enrollment did not start');
		}

		expect(secretFromTotpUri(started.enrollment.totpUri)).toBe(started.enrollment.secret);
		expect(started.enrollment.backupCodes).toHaveLength(10);
		expect(
			await confirmTwoFactorEnrollment(
				harness.runtime,
				harness.request(jar, '198.51.100.2'),
				await actorOf(jar),
				'000000'
			)
		).toBe('invalid_code');
		expect((await actorOf(jar)).twoFactorEnabled).toBe(false);
		expect(
			await confirmTwoFactorEnrollment(
				harness.runtime,
				harness.request(jar, '198.51.100.3'),
				await actorOf(jar),
				generateTotp(started.enrollment.secret)
			)
		).toBe('enabled');
		expect((await actorOf(jar)).twoFactorEnabled).toBe(true);
		expect(countRemainingBackupCodes(harness.runtime.db, userId)).toBe(10);
		expect(actions()).toContain('auth.two_factor_enabled');
	});

	it('requires the password to start', async () => {
		const jar = await signedInJar('198.51.100.4');

		expect(
			await startTwoFactorEnrollment(
				harness.runtime,
				harness.request(jar),
				await actorOf(jar),
				'not-the-password'
			)
		).toEqual({ status: 'invalid_password' });
		expect(harness.runtime.db.select().from(twoFactor).all()).toHaveLength(0);
	});

	it('does not challenge sign-ins before the enrollment is confirmed', async () => {
		const jar = await signedInJar('198.51.100.5');

		await startTwoFactorEnrollment(
			harness.runtime,
			harness.request(jar),
			await actorOf(jar),
			PASSWORD
		);

		expect(
			await signInWithPassword(
				harness.runtime,
				harness.request(new TestCookieJar(), '198.51.100.6'),
				{ email: EMAIL, password: PASSWORD }
			)
		).toEqual({ status: 'signed_in' });
	});
});

describe('two-factor management', () => {
	it('disables with password and code, keeping only the current session', async () => {
		const other = await signedInJar('198.51.100.10');
		const jar = await signedInJar('198.51.100.11');
		const { secret } = await enable(jar);
		const actor = await actorOf(jar);
		const current = await harness.currentSession(jar);

		expect(
			await disableTwoFactor(
				harness.runtime,
				harness.request(jar, '198.51.100.12'),
				actor,
				current.session.id,
				{ password: PASSWORD, totpCode: null }
			)
		).toBe('missing_code');
		expect(
			await disableTwoFactor(
				harness.runtime,
				harness.request(jar, '198.51.100.13'),
				actor,
				current.session.id,
				{ password: PASSWORD, totpCode: generateTotp(secret) }
			)
		).toBe('disabled');
		expect(
			harness.runtime.db.select().from(user).where(eq(user.id, userId)).get()
		).toMatchObject({ twoFactorEnabled: false });
		expect(harness.runtime.db.select().from(twoFactor).all()).toHaveLength(0);
		expect(harness.runtime.db.select().from(session).all()).toMatchObject([
			{ id: current.session.id }
		]);
		expect(
			await harness.runtime.auth.api.getSession({ headers: harness.request(other).headers })
		).toBeNull();
		expect(actions()).toContain('auth.two_factor_disabled');
	});

	it('regenerates backup codes and invalidates the old ones', async () => {
		const jar = await signedInJar('198.51.100.20');
		const { secret, backupCodes } = await enable(jar);
		const regenerated = await regenerateBackupCodes(
			harness.runtime,
			harness.request(jar, '198.51.100.21'),
			await actorOf(jar),
			{ password: PASSWORD, totpCode: generateTotp(secret) }
		);

		if (regenerated.status !== 'regenerated') {
			throw new Error('Backup codes were not regenerated');
		}

		expect(regenerated.backupCodes).toHaveLength(10);
		expect(regenerated.backupCodes).not.toContain(backupCodes[0]);
		expect(actions()).toContain('auth.backup_codes_regenerated');

		const signIn = new TestCookieJar();

		await signInWithPassword(harness.runtime, harness.request(signIn, '198.51.100.22'), {
			email: EMAIL,
			password: PASSWORD
		});

		expect(
			await verifySignInCode(harness.runtime, harness.request(signIn, '198.51.100.23'), {
				method: 'backup_code',
				code: backupCodes[0]
			})
		).toEqual({ status: 'invalid_code' });
		expect(
			await verifySignInCode(harness.runtime, harness.request(signIn, '198.51.100.24'), {
				method: 'backup_code',
				code: regenerated.backupCodes[0].replace('-', '')
			})
		).toEqual({ status: 'signed_in' });
		expect(countRemainingBackupCodes(harness.runtime.db, userId)).toBe(9);
	});

	it('refuses management actions without two-factor authentication', async () => {
		const jar = await signedInJar('198.51.100.30');
		const actor = await actorOf(jar);
		const current = await harness.currentSession(jar);

		expect(
			await disableTwoFactor(
				harness.runtime,
				harness.request(jar),
				actor,
				current.session.id,
				{
					password: PASSWORD,
					totpCode: null
				}
			)
		).toBe('not_enabled');
		expect(
			await regenerateBackupCodes(harness.runtime, harness.request(jar), actor, {
				password: PASSWORD,
				totpCode: null
			})
		).toEqual({ status: 'not_enabled' });
	});
});
