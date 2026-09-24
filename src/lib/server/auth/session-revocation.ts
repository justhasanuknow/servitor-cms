import { eq } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AppDatabase } from '../db';
import { session, user } from '../db/schema';
import type { SessionRevocationResult } from './session-revocation.interfaces';

export function revokeSessionsFromCli(
	db: AppDatabase,
	email: string | null
): SessionRevocationResult {
	return db.transaction((tx) => {
		if (email === null) {
			const revoked = tx.delete(session).run();

			recordAuditEntry(tx, {
				actorType: 'cli',
				action: 'auth.session_revoked',
				details: { scope: 'all_users', count: revoked.changes }
			});

			return { status: 'revoked', count: revoked.changes };
		}

		const target = tx
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, email.trim().toLowerCase()))
			.get();

		if (!target) {
			return { status: 'unknown_user' };
		}

		const revoked = tx.delete(session).where(eq(session.userId, target.id)).run();

		recordAuditEntry(tx, {
			actorType: 'cli',
			action: 'auth.session_revoked',
			targetType: 'user',
			targetId: target.id,
			details: { scope: 'user', count: revoked.changes }
		});

		return { status: 'revoked', count: revoked.changes };
	});
}
