import { desc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env';
import { account, auditLog, session, twoFactor, user } from '../db/schema';
import { createLogger } from '../logging/logger';
import { createTestDatabase } from '../testing/database';
import { FounderMissingError, resetFounder } from './founder-reset';
import { ensureFounder } from './founder-seed';
import { verifyPassword } from './password-hash';

const FOUNDER_PASSWORD = 'Kx7-quiet-harbor-19';

let database: ReturnType<typeof createTestDatabase>;

beforeEach(() => {
	database = createTestDatabase();
});

afterEach(() => {
	database.dispose();
});

async function seedFounder(): Promise<string> {
	const env = parseEnv({
		ORIGIN: 'https://cms.example.com',
		BETTER_AUTH_SECRET: 'x'.repeat(40),
		FOUNDER_EMAIL: 'founder@example.com',
		FOUNDER_NAME: 'Ada Founder',
		FOUNDER_PASSWORD
	});

	await ensureFounder(database.db, env, createLogger('silent'));

	const founder = database.db.select().from(user).where(eq(user.role, 'founder')).get();

	return founder?.id ?? '';
}

describe('resetFounder', () => {
	it('fails when no founder exists yet', async () => {
		await expect(resetFounder(database.db)).rejects.toThrow(FounderMissingError);
	});

	it('sets a temporary password, disables two-factor and ends every session', async () => {
		const founderId = await seedFounder();

		database.db
			.update(user)
			.set({ mustChangePassword: false, twoFactorEnabled: true })
			.where(eq(user.id, founderId))
			.run();
		database.db
			.insert(twoFactor)
			.values({
				id: crypto.randomUUID(),
				secret: 'secret',
				backupCodes: '[]',
				userId: founderId
			})
			.run();
		database.db
			.insert(session)
			.values({
				id: crypto.randomUUID(),
				token: crypto.randomUUID(),
				userId: founderId,
				expiresAt: new Date(Date.now() + 60 * 60 * 1000),
				updatedAt: new Date()
			})
			.run();

		const temporaryPassword = await resetFounder(database.db);
		const credential = database.db
			.select()
			.from(account)
			.where(eq(account.userId, founderId))
			.get();
		const latestAudit = database.db
			.select()
			.from(auditLog)
			.orderBy(desc(auditLog.createdAt))
			.get();

		expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{24}$/);
		expect(await verifyPassword(credential?.password ?? '', temporaryPassword)).toBe(true);
		expect(await verifyPassword(credential?.password ?? '', FOUNDER_PASSWORD)).toBe(false);
		expect(database.db.select().from(user).where(eq(user.id, founderId)).get()).toMatchObject({
			mustChangePassword: true,
			twoFactorEnabled: false
		});
		expect(database.db.select().from(twoFactor).all()).toHaveLength(0);
		expect(database.db.select().from(session).all()).toHaveLength(0);
		expect(latestAudit).toMatchObject({
			actorType: 'cli',
			action: 'auth.founder_reset',
			targetType: 'user',
			targetId: founderId
		});
	});
});
