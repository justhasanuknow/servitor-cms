import { generateRandomString, hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AppDatabase } from '../db';
import { account, session, twoFactor, user } from '../db/schema';

const TEMPORARY_PASSWORD_LENGTH = 24;

export class FounderMissingError extends Error {
	constructor() {
		super('No founder account exists yet. Start the application once to create it.');
		this.name = 'FounderMissingError';
	}
}

export async function resetFounder(db: AppDatabase): Promise<string> {
	const founder = db.select({ id: user.id }).from(user).where(eq(user.role, 'founder')).get();

	if (!founder) {
		throw new FounderMissingError();
	}

	const temporaryPassword = generateRandomString(TEMPORARY_PASSWORD_LENGTH, 'a-z', 'A-Z', '0-9');
	const passwordHash = await hashPassword(temporaryPassword);
	const now = new Date();

	db.transaction((tx) => {
		const updated = tx
			.update(account)
			.set({ password: passwordHash, updatedAt: now })
			.where(and(eq(account.userId, founder.id), eq(account.providerId, 'credential')))
			.run();

		if (updated.changes === 0) {
			tx.insert(account)
				.values({
					id: crypto.randomUUID(),
					accountId: founder.id,
					providerId: 'credential',
					userId: founder.id,
					password: passwordHash,
					updatedAt: now
				})
				.run();
		}

		tx.update(user)
			.set({ mustChangePassword: true, twoFactorEnabled: false })
			.where(eq(user.id, founder.id))
			.run();
		tx.delete(twoFactor).where(eq(twoFactor.userId, founder.id)).run();
		tx.delete(session).where(eq(session.userId, founder.id)).run();
		recordAuditEntry(tx, {
			actorType: 'cli',
			action: 'auth.founder_reset',
			targetType: 'user',
			targetId: founder.id
		});
	});

	return temporaryPassword;
}
