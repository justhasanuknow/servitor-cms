import type { Runtime } from '../runtime.interfaces';
import { RATE_LIMIT_RULES } from '../security/rate-limiter';
import type { AuthUser } from './auth';
import type { AuthRequest } from './auth-request.interfaces';
import type { ReauthenticationInput, ReauthenticationResult } from './reauthentication.interfaces';

export async function reauthenticate(
	runtime: Runtime,
	request: AuthRequest,
	user: AuthUser,
	input: ReauthenticationInput
): Promise<ReauthenticationResult> {
	if (!consumeAttempt(runtime, request, user)) {
		return 'rate_limited';
	}

	try {
		await runtime.auth.api.verifyPassword({
			body: { password: input.password },
			headers: request.headers
		});
	} catch {
		return 'invalid_password';
	}

	if (user.twoFactorEnabled !== true) {
		return 'verified';
	}

	if (input.totpCode === null) {
		return 'missing_code';
	}

	try {
		await runtime.auth.api.verifyTOTP({
			body: { code: input.totpCode },
			headers: request.headers
		});
	} catch {
		return 'invalid_code';
	}

	return 'verified';
}

function consumeAttempt(runtime: Runtime, request: AuthRequest, user: AuthUser): boolean {
	const rule = RATE_LIMIT_RULES.sensitiveAction;
	const byUser = runtime.rateLimiter.consume(`sensitive:user:${user.id}`, rule);
	const byAddress = runtime.rateLimiter.consume(`sensitive:ip:${request.ip ?? 'unknown'}`, rule);

	return byUser.allowed && byAddress.allowed;
}
