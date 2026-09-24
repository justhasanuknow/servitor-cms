import { and, desc, eq } from 'drizzle-orm';
import { getLocale } from '../../paraglide/runtime';
import { auditLog, user } from '../db/schema';
import { recipientLocale, sendEmailLater, siteName } from '../email/notifications';
import { newDeviceEmail } from '../email/templates';
import { summarizeUserAgent } from '../http/user-agent';
import type { Runtime } from '../runtime.interfaces';
import type { AuthRequest } from './auth-request.interfaces';

const HISTORY_LIMIT = 200;

const MAX_DEVICE_LENGTH = 200;

export function deviceSignature(userAgent: string | null): string {
	const summary = summarizeUserAgent(userAgent);

	return `${summary.browser ?? '?'}|${summary.os ?? '?'}`;
}

function deviceName(userAgent: string | null): string {
	const summary = summarizeUserAgent(userAgent);
	const parts = [summary.browser, summary.os].filter((part): part is string => part !== null);

	if (parts.length > 0) {
		return parts.join(' · ');
	}

	return (userAgent ?? '?').slice(0, MAX_DEVICE_LENGTH);
}

export function isNewDevice(runtime: Runtime, userId: string, userAgent: string | null): boolean {
	const previous = runtime.db
		.select({ userAgent: auditLog.userAgent })
		.from(auditLog)
		.where(and(eq(auditLog.action, 'auth.login_succeeded'), eq(auditLog.actorId, userId)))
		.orderBy(desc(auditLog.createdAt))
		.limit(HISTORY_LIMIT)
		.all();

	if (previous.length === 0) {
		return false;
	}

	const signature = deviceSignature(userAgent);

	return !previous.some((entry) => deviceSignature(entry.userAgent) === signature);
}

export function notifyNewDevice(
	runtime: Runtime,
	request: AuthRequest,
	userId: string,
	now: Date = new Date()
): void {
	if (!runtime.mailer.enabled || !isNewDevice(runtime, userId, request.userAgent)) {
		return;
	}

	const owner = runtime.db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, userId))
		.get();

	if (owner === undefined) {
		return;
	}

	const locale = recipientLocale(runtime.db, userId, getLocale());
	const time = new Intl.DateTimeFormat(locale, {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone: 'UTC'
	}).format(now);

	sendEmailLater(
		runtime,
		owner.email,
		newDeviceEmail(locale, siteName(runtime.db), {
			device: deviceName(request.userAgent),
			ip: request.ip ?? '?',
			time: `${time} UTC`
		})
	);
}
