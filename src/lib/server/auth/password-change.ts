import { eq } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import { user } from '../db/schema';
import type { Runtime } from '../runtime.interfaces';
import type { AuthUser } from './auth';
import { authErrorCode } from './auth-errors';
import type { AuthRequest } from './auth-request.interfaces';
import type { PasswordChangeInput, PasswordChangeResult } from './password-change.interfaces';
import { passwordContextFor } from './password-context';
import { findPasswordPolicyViolation } from './password-policy';
import { reauthenticate } from './reauthentication';

export async function changeOwnPassword(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: PasswordChangeInput
): Promise<PasswordChangeResult> {
	const violation = findPasswordPolicyViolation(
		input.newPassword,
		passwordContextFor(runtime.db, runtime.env.ORIGIN, actor.id)
	);

	if (violation !== null) {
		return violation;
	}

	if (input.newPassword === input.currentPassword) {
		return 'reused';
	}

	const verification = await reauthenticate(runtime, request, actor, {
		password: input.currentPassword,
		totpCode: input.totpCode
	});

	if (verification !== 'verified') {
		return verification;
	}

	try {
		await runtime.auth.api.changePassword({
			body: {
				currentPassword: input.currentPassword,
				newPassword: input.newPassword,
				revokeOtherSessions: true
			},
			headers: request.headers
		});
	} catch (error) {
		if (authErrorCode(error) === 'INVALID_PASSWORD') {
			return 'invalid_password';
		}

		throw error;
	}

	runtime.db.transaction((tx) => {
		tx.update(user)
			.set({ mustChangePassword: false, updatedAt: new Date() })
			.where(eq(user.id, actor.id))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'auth.password_changed',
			targetType: 'user',
			targetId: actor.id,
			details: { sessionsRevoked: true },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'changed';
}
