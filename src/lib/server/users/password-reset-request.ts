import { and, eq, isNull } from 'drizzle-orm';
import type { UiLocale } from '../../constants/preferences';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { account, user } from '../db/schema';
import { recipientLocale, sendEmailLater, siteName } from '../email/notifications';
import { passwordResetEmail } from '../email/templates';
import type { Runtime } from '../runtime.interfaces';
import { RATE_LIMIT_RULES } from '../security/rate-limiter';
import type { PasswordResetRequestResult } from './password-reset-request.interfaces';
import { accountLink, issueUserToken } from './tokens';

function resettableUser(runtime: Runtime, email: string) {
	return runtime.db
		.select({ id: user.id, email: user.email })
		.from(user)
		.innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
		.where(and(eq(user.email, email), isNull(user.deactivatedAt)))
		.get();
}

export function requestPasswordReset(
	runtime: Runtime,
	request: AuthRequest,
	email: string,
	locale: UiLocale
): PasswordResetRequestResult {
	if (!runtime.mailer.enabled) {
		return 'unavailable';
	}

	const byAddress = runtime.rateLimiter.consume(
		`password-reset:ip:${request.ip ?? 'unknown'}`,
		RATE_LIMIT_RULES.passwordResetByAddress
	);

	if (!byAddress.allowed) {
		return 'rate_limited';
	}

	const byEmail = runtime.rateLimiter.consume(
		`password-reset:email:${email}`,
		RATE_LIMIT_RULES.passwordResetByEmail
	);
	const target = resettableUser(runtime, email);

	if (!byEmail.allowed || target === undefined) {
		return 'requested';
	}

	const token = runtime.db.transaction((tx) => {
		recordAuditEntry(tx, {
			actorType: 'anonymous',
			action: 'user.password_reset_link_created',
			targetType: 'user',
			targetId: target.id,
			details: { via: 'email' },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return issueUserToken(tx, { userId: target.id, type: 'password_reset', createdBy: null });
	});

	sendEmailLater(
		runtime,
		target.email,
		passwordResetEmail(
			recipientLocale(runtime.db, target.id, locale),
			siteName(runtime.db),
			accountLink(runtime.env.ORIGIN, 'reset-password', token)
		)
	);

	return 'requested';
}
