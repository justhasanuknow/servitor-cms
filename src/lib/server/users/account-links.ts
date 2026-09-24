import { and, eq } from 'drizzle-orm';
import type { UserTokenType } from '../../constants/users';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { passwordContextFor } from '../auth/password-context';
import { hashPassword } from '../auth/password-hash';
import { findPasswordPolicyViolation } from '../auth/password-policy';
import type { AppDatabase } from '../db';
import { account, session, user } from '../db/schema';
import type { Runtime } from '../runtime.interfaces';
import type {
	AccountLinkOwner,
	AccountLinkResult,
	NewPasswordInput
} from './account-links.interfaces';
import { consumeUserToken, findActiveUserToken } from './tokens';

export function describeAccountLink(
	db: AppDatabase,
	type: UserTokenType,
	token: string
): AccountLinkOwner | null {
	const active = findActiveUserToken(db, type, token);

	if (!active) {
		return null;
	}

	const owner = db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, active.userId))
		.get();

	return owner ?? null;
}

export async function acceptInvite(
	runtime: Runtime,
	request: AuthRequest,
	token: string,
	input: NewPasswordInput
): Promise<AccountLinkResult> {
	const active = findActiveUserToken(runtime.db, 'invite', token);

	if (!active || hasCredential(runtime.db, active.userId)) {
		return 'invalid_link';
	}

	const problem = newPasswordProblem(runtime, active.userId, input);

	if (problem !== null) {
		return problem;
	}

	const passwordHash = await hashPassword(input.password);

	return runtime.db.transaction((tx) => {
		if (!consumeUserToken(tx, active.id)) {
			return 'invalid_link';
		}

		tx.insert(account)
			.values({
				id: crypto.randomUUID(),
				accountId: active.userId,
				providerId: 'credential',
				userId: active.userId,
				password: passwordHash,
				updatedAt: new Date()
			})
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: active.userId,
			action: 'user.invite_accepted',
			targetType: 'user',
			targetId: active.userId,
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'completed';
	});
}

export async function completePasswordReset(
	runtime: Runtime,
	request: AuthRequest,
	token: string,
	input: NewPasswordInput
): Promise<AccountLinkResult> {
	const active = findActiveUserToken(runtime.db, 'password_reset', token);

	if (!active || !hasCredential(runtime.db, active.userId)) {
		return 'invalid_link';
	}

	const problem = newPasswordProblem(runtime, active.userId, input);

	if (problem !== null) {
		return problem;
	}

	const passwordHash = await hashPassword(input.password);

	return runtime.db.transaction((tx) => {
		if (!consumeUserToken(tx, active.id)) {
			return 'invalid_link';
		}

		tx.update(account)
			.set({ password: passwordHash, updatedAt: new Date() })
			.where(and(eq(account.userId, active.userId), eq(account.providerId, 'credential')))
			.run();
		tx.update(user)
			.set({ mustChangePassword: false, updatedAt: new Date() })
			.where(eq(user.id, active.userId))
			.run();

		const revoked = tx.delete(session).where(eq(session.userId, active.userId)).run();

		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: active.userId,
			action: 'auth.password_reset',
			targetType: 'user',
			targetId: active.userId,
			details: { sessionsRevoked: revoked.changes },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'completed';
	});
}

function newPasswordProblem(
	runtime: Runtime,
	userId: string,
	input: NewPasswordInput
): AccountLinkResult | null {
	const violation = findPasswordPolicyViolation(
		input.password,
		passwordContextFor(runtime.db, runtime.env.ORIGIN, userId)
	);

	if (violation !== null) {
		return violation;
	}

	if (input.password !== input.confirmation) {
		return 'mismatch';
	}

	return null;
}

function hasCredential(db: AppDatabase, userId: string): boolean {
	const row = db
		.select({ password: account.password })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
		.get();

	return row !== undefined && row.password !== null;
}
