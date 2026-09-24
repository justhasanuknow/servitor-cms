import { hashPassword as hashLegacyPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import {
	hashPassword,
	PASSWORD_HASH_PARAMETERS,
	passwordHashNeedsUpgrade,
	verifyPassword
} from './password-hash';
import { signInWithPassword } from './sign-in';

const PASSWORD = 'Kx7-quiet-harbor-19';

describe('hashPassword', () => {
	it('writes a self-describing scrypt hash with the configured cost', async () => {
		const hash = await hashPassword(PASSWORD);

		expect(hash).toMatch(/^\$scrypt\$ln=15,r=8,p=3\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{86}$/);
		expect(PASSWORD_HASH_PARAMETERS).toEqual({ logN: 15, r: 8, p: 3 });
		expect(passwordHashNeedsUpgrade(hash)).toBe(false);
	});

	it('salts every hash', async () => {
		expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
	});
});

describe('verifyPassword', () => {
	it('accepts the right password and rejects others', async () => {
		const hash = await hashPassword(PASSWORD);

		expect(await verifyPassword(hash, PASSWORD)).toBe(true);
		expect(await verifyPassword(hash, 'Kx7-quiet-harbor-18')).toBe(false);
	});

	it('treats compatible Unicode forms of a password as the same password', async () => {
		const hash = await hashPassword('Ｃafé-quiet-harbor');

		expect(await verifyPassword(hash, 'Café-quiet-harbor')).toBe(true);
	});

	it('still verifies hashes from earlier parameters and marks them for an upgrade', async () => {
		const legacy = await hashLegacyPassword(PASSWORD);

		expect(await verifyPassword(legacy, PASSWORD)).toBe(true);
		expect(await verifyPassword(legacy, 'Kx7-quiet-harbor-18')).toBe(false);
		expect(passwordHashNeedsUpgrade(legacy)).toBe(true);
	});

	it('rejects malformed hashes and parameters outside the safe range', async () => {
		const hash = await hashPassword(PASSWORD);

		expect(await verifyPassword('not-a-hash', PASSWORD)).toBe(false);
		expect(await verifyPassword(hash.replace('ln=15', 'ln=30'), PASSWORD)).toBe(false);
	});
});

describe('hash upgrades on sign-in', () => {
	let harness: ReturnType<typeof createTestRuntime>;

	beforeEach(() => {
		harness = createTestRuntime();
	});

	afterEach(() => {
		harness.dispose();
	});

	function storedHash(userId: string): string | null {
		return (
			harness.runtime.db
				.select({ password: account.password })
				.from(account)
				.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
				.get()?.password ?? null
		);
	}

	it('rehashes a legacy hash with the current parameters after a successful sign-in', async () => {
		const userId = await harness.createUser({
			email: 'author@example.com',
			password: PASSWORD
		});

		harness.runtime.db
			.update(account)
			.set({ password: await hashLegacyPassword(PASSWORD) })
			.where(eq(account.userId, userId))
			.run();

		const failed = await signInWithPassword(
			harness.runtime,
			harness.request(new TestCookieJar(), '192.0.2.10'),
			{ email: 'author@example.com', password: 'Kx7-quiet-harbor-18' }
		);

		expect(failed.status).toBe('invalid_credentials');
		expect(passwordHashNeedsUpgrade(storedHash(userId) ?? '')).toBe(true);

		const signedIn = await signInWithPassword(
			harness.runtime,
			harness.request(new TestCookieJar(), '192.0.2.11'),
			{ email: 'author@example.com', password: PASSWORD }
		);
		const upgraded = storedHash(userId) ?? '';

		expect(signedIn.status).toBe('signed_in');
		expect(passwordHashNeedsUpgrade(upgraded)).toBe(false);
		expect(await verifyPassword(upgraded, PASSWORD)).toBe(true);
	});
});
