import { eq } from 'drizzle-orm';
import type { AuditAction } from '../../constants/audit';
import { recordAuditEntry } from '../audit/audit-log';
import type { AppDatabase } from '../db';
import { twoFactor, user } from '../db/schema';
import type { Runtime } from '../runtime.interfaces';
import { RATE_LIMIT_RULES } from '../security/rate-limiter';
import { authErrorCode } from './auth-errors';
import type { AuthRequest } from './auth-request.interfaces';
import type {
	PasswordCredentials,
	PasswordSignInResult,
	TwoFactorCode,
	TwoFactorSignInResult
} from './sign-in.interfaces';

const INVALID_CREDENTIAL_CODES = new Set([
	'INVALID_EMAIL',
	'INVALID_EMAIL_OR_PASSWORD',
	'FAILED_TO_CREATE_SESSION'
]);

const INVALID_CODE_CODES = new Set(['INVALID_CODE', 'INVALID_BACKUP_CODE']);

const LOCKED_CODES = new Set(['ACCOUNT_TEMPORARILY_LOCKED']);

const EXPIRED_CHALLENGE_CODES = new Set([
	'INVALID_TWO_FACTOR_COOKIE',
	'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE',
	'TOTP_NOT_ENABLED',
	'BACKUP_CODES_NOT_ENABLED',
	'FAILED_TO_CREATE_SESSION'
]);

export async function signInWithPassword(
	runtime: Runtime,
	request: AuthRequest,
	credentials: PasswordCredentials
): Promise<PasswordSignInResult> {
	const limit = runtime.rateLimiter.consume(
		`sign-in:ip:${request.ip ?? 'unknown'}`,
		RATE_LIMIT_RULES.signIn
	);

	if (!limit.allowed) {
		return { status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };
	}

	const targetId = findUserIdByEmail(runtime.db, credentials.email);

	if (runtime.loginLockout.isLocked(credentials.email)) {
		recordAnonymousAttempt(runtime, request, 'auth.login_failed', targetId, {
			stage: 'password',
			reason: 'locked'
		});

		return { status: 'locked' };
	}

	let result: Awaited<ReturnType<Runtime['auth']['api']['signInEmail']>>;

	try {
		result = await runtime.auth.api.signInEmail({
			body: { email: credentials.email, password: credentials.password, rememberMe: true },
			headers: request.headers
		});
	} catch (error) {
		const code = authErrorCode(error);

		if (code === null || !INVALID_CREDENTIAL_CODES.has(code)) {
			throw error;
		}

		return recordPasswordFailure(runtime, request, credentials.email, targetId);
	}

	if ('twoFactorRedirect' in result && result.twoFactorRedirect === true) {
		return { status: 'two_factor_required' };
	}

	runtime.loginLockout.reset(credentials.email);
	recordSuccessfulSignIn(runtime, request, result.user.id, 'password');

	return { status: 'signed_in' };
}

export async function findPendingTwoFactorUser(
	runtime: Runtime,
	request: AuthRequest
): Promise<string | null> {
	const challenge = await runtime.auth.api.getTwoFactorChallenge({ headers: request.headers });

	return challenge.userId;
}

export async function verifySignInCode(
	runtime: Runtime,
	request: AuthRequest,
	input: TwoFactorCode
): Promise<TwoFactorSignInResult> {
	const limit = runtime.rateLimiter.consume(
		`two-factor:ip:${request.ip ?? 'unknown'}`,
		RATE_LIMIT_RULES.twoFactor
	);

	if (!limit.allowed) {
		return { status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };
	}

	const userId = await findPendingTwoFactorUser(runtime, request);

	if (userId === null) {
		return { status: 'challenge_expired' };
	}

	const wasLocked = isTwoFactorLocked(runtime.db, userId);

	try {
		await submitTwoFactorCode(runtime, request, input);
	} catch (error) {
		const code = authErrorCode(error);

		if (code === null) {
			throw error;
		}

		return recordTwoFactorFailure(runtime, request, userId, input, code, wasLocked);
	}

	const email = findEmailByUserId(runtime.db, userId);

	if (email !== null) {
		runtime.loginLockout.reset(email);
	}

	recordSuccessfulSignIn(runtime, request, userId, input.method);

	return { status: 'signed_in' };
}

async function submitTwoFactorCode(
	runtime: Runtime,
	request: AuthRequest,
	input: TwoFactorCode
): Promise<void> {
	if (input.method === 'totp') {
		await runtime.auth.api.verifyTOTP({ body: { code: input.code }, headers: request.headers });

		return;
	}

	await runtime.auth.api.verifyBackupCode({
		body: { code: input.code },
		headers: request.headers
	});
}

function recordPasswordFailure(
	runtime: Runtime,
	request: AuthRequest,
	email: string,
	targetId: string | null
): PasswordSignInResult {
	const update = runtime.loginLockout.recordFailure(email);

	recordAnonymousAttempt(runtime, request, 'auth.login_failed', targetId, {
		stage: 'password',
		reason: 'invalid_credentials'
	});

	if (!update.lockedNow) {
		return { status: 'invalid_credentials' };
	}

	recordAnonymousAttempt(runtime, request, 'auth.account_locked', targetId, {
		stage: 'password'
	});
	runtime.logger.warn({ targetId }, 'Account locked after repeated failed sign-in attempts');

	return { status: 'locked' };
}

function recordTwoFactorFailure(
	runtime: Runtime,
	request: AuthRequest,
	userId: string,
	input: TwoFactorCode,
	code: string,
	wasLocked: boolean
): TwoFactorSignInResult {
	if (LOCKED_CODES.has(code)) {
		recordAnonymousAttempt(runtime, request, 'auth.login_failed', userId, {
			stage: 'two_factor',
			method: input.method,
			reason: 'locked'
		});

		return { status: 'locked' };
	}

	if (EXPIRED_CHALLENGE_CODES.has(code)) {
		recordAnonymousAttempt(runtime, request, 'auth.login_failed', userId, {
			stage: 'two_factor',
			method: input.method,
			reason: 'challenge_expired'
		});

		return { status: 'challenge_expired' };
	}

	if (!INVALID_CODE_CODES.has(code)) {
		throw new Error(`Unexpected two-factor verification error: ${code}`);
	}

	recordAnonymousAttempt(runtime, request, 'auth.login_failed', userId, {
		stage: 'two_factor',
		method: input.method,
		reason: 'invalid_code'
	});

	if (wasLocked || !isTwoFactorLocked(runtime.db, userId)) {
		return { status: 'invalid_code' };
	}

	recordAnonymousAttempt(runtime, request, 'auth.account_locked', userId, {
		stage: 'two_factor'
	});
	runtime.logger.warn(
		{ targetId: userId },
		'Account locked after repeated failed two-factor attempts'
	);

	return { status: 'locked' };
}

function recordSuccessfulSignIn(
	runtime: Runtime,
	request: AuthRequest,
	userId: string,
	method: string
): void {
	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: userId,
		action: 'auth.login_succeeded',
		targetType: 'user',
		targetId: userId,
		details: { method },
		ip: request.ip,
		userAgent: request.userAgent
	});
}

function recordAnonymousAttempt(
	runtime: Runtime,
	request: AuthRequest,
	action: AuditAction,
	targetId: string | null,
	details: Record<string, string>
): void {
	let targetType: string | null = null;

	if (targetId !== null) {
		targetType = 'user';
	}

	recordAuditEntry(runtime.db, {
		actorType: 'anonymous',
		action,
		targetType,
		targetId,
		details,
		ip: request.ip,
		userAgent: request.userAgent
	});
}

function findUserIdByEmail(db: AppDatabase, email: string): string | null {
	const row = db.select({ id: user.id }).from(user).where(eq(user.email, email)).get();

	return row?.id ?? null;
}

function findEmailByUserId(db: AppDatabase, userId: string): string | null {
	const row = db.select({ email: user.email }).from(user).where(eq(user.id, userId)).get();

	return row?.email ?? null;
}

function isTwoFactorLocked(db: AppDatabase, userId: string): boolean {
	const row = db
		.select({ lockedUntil: twoFactor.lockedUntil })
		.from(twoFactor)
		.where(eq(twoFactor.userId, userId))
		.get();

	if (!row || row.lockedUntil === null) {
		return false;
	}

	return row.lockedUntil.getTime() > Date.now();
}
