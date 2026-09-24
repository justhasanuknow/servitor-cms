import { eq } from 'drizzle-orm';
import type { UiLocale } from '../../constants/preferences';
import { toUiLocale } from '../../i18n/locale-negotiation';
import type { DatabaseExecutor } from '../db';
import { userProfiles } from '../db/schema';
import type { Runtime } from '../runtime.interfaces';
import { loadSystemSettings } from '../settings/system-settings';
import { sendInBackground } from './mailer';
import type { EmailContent } from './mailer.interfaces';

export function recipientLocale(
	db: DatabaseExecutor,
	userId: string | null,
	fallback: UiLocale
): UiLocale {
	if (userId === null) {
		return fallback;
	}

	const profile = db
		.select({ uiLocale: userProfiles.uiLocale })
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.get();

	return toUiLocale(profile?.uiLocale) ?? fallback;
}

export function siteName(db: DatabaseExecutor): string {
	return loadSystemSettings(db).siteName;
}

export async function sendEmail(
	runtime: Runtime,
	to: string,
	content: EmailContent
): Promise<boolean> {
	if (!runtime.mailer.enabled) {
		return false;
	}

	try {
		await runtime.mailer.send({ to, ...content });

		return true;
	} catch (error) {
		runtime.logger.error({ err: error }, 'An email could not be sent');

		return false;
	}
}

export function sendEmailLater(runtime: Runtime, to: string, content: EmailContent): void {
	if (runtime.mailer.enabled) {
		sendInBackground(runtime.mailer, runtime.logger, { to, ...content });
	}
}
