import type { UiLocale } from '../../constants/preferences';
import type { Runtime } from '../runtime.interfaces';
import type { EmailOutcome } from './account-emails.interfaces';
import { recipientLocale, sendEmail, siteName } from './notifications';
import { inviteEmail, passwordResetEmail } from './templates';

function outcome(runtime: Runtime, sent: boolean): EmailOutcome {
	if (!runtime.mailer.enabled) {
		return 'disabled';
	}

	if (sent) {
		return 'sent';
	}

	return 'failed';
}

export async function emailInvitation(
	runtime: Runtime,
	to: string,
	inviterName: string,
	link: string,
	locale: UiLocale
): Promise<EmailOutcome> {
	const sent = await sendEmail(
		runtime,
		to,
		inviteEmail(locale, siteName(runtime.db), inviterName, link)
	);

	return outcome(runtime, sent);
}

export async function emailPasswordResetLink(
	runtime: Runtime,
	userId: string,
	to: string,
	link: string,
	locale: UiLocale
): Promise<EmailOutcome> {
	const sent = await sendEmail(
		runtime,
		to,
		passwordResetEmail(recipientLocale(runtime.db, userId, locale), siteName(runtime.db), link)
	);

	return outcome(runtime, sent);
}
