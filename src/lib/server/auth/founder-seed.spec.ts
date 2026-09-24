import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../config/env';
import { account, auditLog, user, userProfiles } from '../db/schema';
import { createLogger } from '../logging/logger';
import { createTestDatabase } from '../testing/database';
import commonPasswordList from './common-passwords.txt?raw';
import { ensureFounder } from './founder-seed';
import { verifyPassword } from './password-hash';

const logger = createLogger('silent');

const FOUNDER_PASSWORD = 'Kx7-quiet-harbor-19';

const COMMON_LONG_PASSWORD = commonPasswordList
	.split(/\r?\n/)
	.map((entry) => entry.trim())
	.find((entry) => entry.length >= 12);

function envWith(overrides: Record<string, string | undefined> = {}) {
	return parseEnv({
		ORIGIN: 'https://cms.example.com',
		BETTER_AUTH_SECRET: 'x'.repeat(40),
		FOUNDER_EMAIL: 'Founder@Example.com',
		FOUNDER_NAME: 'Ada Founder',
		FOUNDER_PASSWORD,
		...overrides
	});
}

let database: ReturnType<typeof createTestDatabase>;

beforeEach(() => {
	database = createTestDatabase();
});

afterEach(() => {
	database.dispose();
});

describe('ensureFounder', () => {
	it('creates the founder with a forced password change', async () => {
		await ensureFounder(database.db, envWith(), logger);

		const founders = database.db.select().from(user).where(eq(user.role, 'founder')).all();

		expect(founders).toHaveLength(1);

		const [founder] = founders;
		const credential = database.db
			.select()
			.from(account)
			.where(eq(account.userId, founder.id))
			.get();

		expect(founder).toMatchObject({
			email: 'founder@example.com',
			name: 'Ada Founder',
			mustChangePassword: true,
			deactivatedAt: null
		});
		expect(credential).toMatchObject({ providerId: 'credential', accountId: founder.id });
		expect(await verifyPassword(credential?.password ?? '', FOUNDER_PASSWORD)).toBe(true);
		expect(
			database.db.select().from(userProfiles).where(eq(userProfiles.userId, founder.id)).get()
		).toMatchObject({ themePalette: 'neutral', themeMode: 'system' });
		expect(database.db.select().from(auditLog).all()).toMatchObject([
			{
				actorType: 'system',
				action: 'user.created',
				targetType: 'user',
				targetId: founder.id
			}
		]);
	});

	it('ignores the founder variables once a founder exists', async () => {
		await ensureFounder(database.db, envWith(), logger);
		await ensureFounder(
			database.db,
			envWith({ FOUNDER_EMAIL: 'other@example.com', FOUNDER_PASSWORD: 'short' }),
			logger
		);

		expect(database.db.select().from(user).all()).toHaveLength(1);
	});

	it.each([
		[{ FOUNDER_EMAIL: undefined }, 'FOUNDER_EMAIL: is required'],
		[{ FOUNDER_EMAIL: 'not-an-email' }, 'FOUNDER_EMAIL: must be a valid email address'],
		[{ FOUNDER_NAME: undefined }, 'FOUNDER_NAME: is required'],
		[{ FOUNDER_PASSWORD: undefined }, 'FOUNDER_PASSWORD: is required'],
		[
			{ FOUNDER_PASSWORD: 'Short-pass1' },
			'FOUNDER_PASSWORD: must be at least 12 characters long'
		]
	])('refuses to start when %j', async (overrides, message) => {
		const seeding = ensureFounder(database.db, envWith(overrides), logger);

		await expect(seeding).rejects.toThrow(EnvValidationError);
		await expect(seeding).rejects.toThrow(message);
		expect(database.db.select().from(user).all()).toHaveLength(0);
	});

	it('refuses to start with a common founder password', async () => {
		expect(COMMON_LONG_PASSWORD).toBeDefined();

		await expect(
			ensureFounder(database.db, envWith({ FOUNDER_PASSWORD: COMMON_LONG_PASSWORD }), logger)
		).rejects.toThrow('FOUNDER_PASSWORD: is too common');
	});
});
