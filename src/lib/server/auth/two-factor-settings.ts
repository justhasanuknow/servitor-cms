import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { recordAuditEntry } from '../audit/audit-log';
import type { AppDatabase } from '../db';
import { session, twoFactor, user } from '../db/schema';
import type { Runtime } from '../runtime.interfaces';
import { RATE_LIMIT_RULES } from '../security/rate-limiter';
import { reportSecurityEvent } from '../security/security-events';
import type { AuthUser } from './auth';
import { authErrorCode } from './auth-errors';
import type { AuthRequest } from './auth-request.interfaces';
import { reauthenticate } from './reauthentication';
import type {
	BackupCodeRegenerationResult,
	EnrollmentConfirmResult,
	EnrollmentStartResult,
	ProtectedActionInput,
	TwoFactorDisableResult
} from './two-factor-settings.interfaces';

const storedBackupCodesSchema = z.array(z.string());

export async function startTwoFactorEnrollment(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	password: string
): Promise<EnrollmentStartResult> {
	if (actor.twoFactorEnabled === true) {
		return { status: 'already_enabled' };
	}

	const verification = await reauthenticate(runtime, request, actor, {
		password,
		totpCode: null
	});

	if (verification !== 'verified') {
		return { status: verification };
	}

	let result: Awaited<ReturnType<Runtime['auth']['api']['enableTwoFactor']>>;

	try {
		result = await runtime.auth.api.enableTwoFactor({
			body: { password },
			headers: request.headers
		});
	} catch (error) {
		const code = authErrorCode(error);

		if (code === 'TOTP_ALREADY_ENABLED') {
			return { status: 'already_enabled' };
		}

		if (code === 'INVALID_PASSWORD') {
			return { status: 'invalid_password' };
		}

		throw error;
	}

	if (!('totpURI' in result)) {
		throw new Error('Two-factor enrollment did not return an authenticator secret');
	}

	return {
		status: 'started',
		enrollment: {
			totpUri: result.totpURI,
			secret: new URL(result.totpURI).searchParams.get('secret') ?? '',
			backupCodes: result.backupCodes
		}
	};
}

export async function confirmTwoFactorEnrollment(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	code: string
): Promise<EnrollmentConfirmResult> {
	if (actor.twoFactorEnabled === true) {
		return 'not_started';
	}

	const limit = runtime.rateLimiter.consume(
		`two-factor:user:${actor.id}`,
		RATE_LIMIT_RULES.twoFactor
	);

	if (!limit.allowed) {
		reportSecurityEvent({
			type: 'rate_limited',
			limit: 'two_factor_enrollment',
			userId: actor.id
		});

		return 'rate_limited';
	}

	if (runtime.totpReplay.wasUsed(actor.id, code)) {
		reportSecurityEvent({ type: 'totp_reused', userId: actor.id });

		return 'invalid_code';
	}

	try {
		await runtime.auth.api.verifyTOTP({ body: { code }, headers: request.headers });
	} catch (error) {
		const errorCode = authErrorCode(error);

		if (errorCode === 'INVALID_CODE') {
			return 'invalid_code';
		}

		if (errorCode === 'TOTP_NOT_ENABLED') {
			return 'not_started';
		}

		throw error;
	}

	runtime.totpReplay.remember(actor.id, code);
	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: actor.id,
		action: 'auth.two_factor_enabled',
		targetType: 'user',
		targetId: actor.id,
		ip: request.ip,
		userAgent: request.userAgent
	});

	return 'enabled';
}

export async function disableTwoFactor(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	currentSessionId: string,
	input: ProtectedActionInput
): Promise<TwoFactorDisableResult> {
	if (actor.twoFactorEnabled !== true) {
		return 'not_enabled';
	}

	const verification = await reauthenticate(runtime, request, actor, input);

	if (verification !== 'verified') {
		return verification;
	}

	runtime.db.transaction((tx) => {
		tx.update(user)
			.set({ twoFactorEnabled: false, updatedAt: new Date() })
			.where(eq(user.id, actor.id))
			.run();
		tx.delete(twoFactor).where(eq(twoFactor.userId, actor.id)).run();

		const revoked = tx
			.delete(session)
			.where(and(eq(session.userId, actor.id), ne(session.id, currentSessionId)))
			.run();

		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'auth.two_factor_disabled',
			targetType: 'user',
			targetId: actor.id,
			details: { otherSessionsRevoked: revoked.changes },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'disabled';
}

export async function regenerateBackupCodes(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: ProtectedActionInput
): Promise<BackupCodeRegenerationResult> {
	if (actor.twoFactorEnabled !== true) {
		return { status: 'not_enabled' };
	}

	const verification = await reauthenticate(runtime, request, actor, input);

	if (verification !== 'verified') {
		return { status: verification };
	}

	const result = await runtime.auth.api.generateBackupCodes({
		body: { password: input.password },
		headers: request.headers
	});

	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: actor.id,
		action: 'auth.backup_codes_regenerated',
		targetType: 'user',
		targetId: actor.id,
		ip: request.ip,
		userAgent: request.userAgent
	});

	return { status: 'regenerated', backupCodes: result.backupCodes };
}

export function hasPendingEnrollment(db: AppDatabase, userId: string): boolean {
	const row = db
		.select({ verified: twoFactor.verified })
		.from(twoFactor)
		.where(eq(twoFactor.userId, userId))
		.get();

	return row !== undefined && row.verified === false;
}

export function countRemainingBackupCodes(db: AppDatabase, userId: string): number | null {
	const row = db
		.select({ backupCodes: twoFactor.backupCodes })
		.from(twoFactor)
		.where(eq(twoFactor.userId, userId))
		.get();

	if (!row) {
		return null;
	}

	const codes = storedBackupCodesSchema.safeParse(parseJson(row.backupCodes));

	if (!codes.success) {
		return null;
	}

	return codes.data.length;
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}
