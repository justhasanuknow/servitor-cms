import { and, eq, ne } from 'drizzle-orm';
import type { UiLocale } from '../../constants/preferences';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { reauthenticate } from '../auth/reauthentication';
import type { ReauthenticationInput } from '../auth/reauthentication.interfaces';
import type { AppDatabase, DatabaseExecutor } from '../db';
import { user } from '../db/schema';
import { recipientLocale, sendEmail, sendEmailLater, siteName } from '../email/notifications';
import { emailChangedNotice, emailChangeVerification } from '../email/templates';
import type { Runtime } from '../runtime.interfaces';
import type {
	EmailChangeConfirmation,
	EmailChangePreview,
	EmailChangeResult
} from './email-change.interfaces';
import { accountLink, consumeUserToken, findActiveUserToken, issueUserToken } from './tokens';

function emailTaken(db: DatabaseExecutor, email: string, userId: string): boolean {
	return (
		db
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.email, email), ne(user.id, userId)))
			.get() !== undefined
	);
}

function applyEmailChange(
	db: DatabaseExecutor,
	request: AuthRequest,
	userId: string,
	from: string,
	to: string,
	verified: boolean
): void {
	db.update(user)
		.set({ email: to, emailVerified: verified, updatedAt: new Date() })
		.where(eq(user.id, userId))
		.run();
	recordAuditEntry(db, {
		actorType: 'user',
		actorId: userId,
		action: 'user.email_changed',
		targetType: 'user',
		targetId: userId,
		details: { from, to, verified },
		ip: request.ip,
		userAgent: request.userAgent
	});
}

export async function requestEmailChange(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	newEmail: string,
	confirmation: ReauthenticationInput,
	locale: UiLocale
): Promise<EmailChangeResult> {
	if (newEmail === actor.email.toLowerCase()) {
		return 'unchanged';
	}

	const verified = await reauthenticate(runtime, request, actor, confirmation);

	if (verified !== 'verified') {
		return verified;
	}

	if (emailTaken(runtime.db, newEmail, actor.id)) {
		return 'email_taken';
	}

	if (!runtime.mailer.enabled) {
		runtime.db.transaction((tx) => {
			applyEmailChange(tx, request, actor.id, actor.email, newEmail, false);
		});

		return 'changed';
	}

	const token = runtime.db.transaction((tx) => {
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'user.email_change_requested',
			targetType: 'user',
			targetId: actor.id,
			details: { to: newEmail },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return issueUserToken(tx, {
			userId: actor.id,
			type: 'email_change',
			createdBy: actor.id,
			newEmail
		});
	});
	const sent = await sendEmail(
		runtime,
		newEmail,
		emailChangeVerification(
			recipientLocale(runtime.db, actor.id, locale),
			siteName(runtime.db),
			newEmail,
			accountLink(runtime.env.ORIGIN, 'verify-email', token)
		)
	);

	if (!sent) {
		return 'email_failed';
	}

	return 'verification_sent';
}

export function describeEmailChange(db: AppDatabase, token: string): EmailChangePreview | null {
	const active = findActiveUserToken(db, 'email_change', token);

	if (active === null || active.newEmail === null) {
		return null;
	}

	return { newEmail: active.newEmail };
}

export function confirmEmailChange(
	runtime: Runtime,
	request: AuthRequest,
	token: string,
	locale: UiLocale
): EmailChangeConfirmation {
	const active = findActiveUserToken(runtime.db, 'email_change', token);

	if (active === null || active.newEmail === null) {
		return 'invalid_link';
	}

	const newEmail = active.newEmail;

	if (emailTaken(runtime.db, newEmail, active.userId)) {
		return 'email_taken';
	}

	const previous = runtime.db.transaction((tx) => {
		const owner = tx
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, active.userId))
			.get();

		if (owner === undefined || !consumeUserToken(tx, active.id)) {
			return null;
		}

		applyEmailChange(tx, request, active.userId, owner.email, newEmail, true);

		return owner.email;
	});

	if (previous === null) {
		return 'invalid_link';
	}

	sendEmailLater(
		runtime,
		previous,
		emailChangedNotice(
			recipientLocale(runtime.db, active.userId, locale),
			siteName(runtime.db),
			newEmail
		)
	);

	return 'changed';
}
