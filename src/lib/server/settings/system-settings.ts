import { and, eq } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { reauthenticate } from '../auth/reauthentication';
import type { ProtectedActionInput } from '../auth/two-factor-settings.interfaces';
import type { DatabaseExecutor } from '../db';
import { contentLanguages, systemSettings } from '../db/schema';
import { defaultLanguageCode, makeDefaultLanguage } from '../languages/languages';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import type {
	SettingsUpdateResult,
	SystemSettingsValues,
	SystemSettingsView
} from './system-settings.interfaces';

export const SITE_NAME_MAX_LENGTH = 100;

export const API_RATE_LIMIT_RANGE = { min: 1, max: 100_000 } as const;

export const REVISION_RETENTION_RANGE = { min: 1, max: 1000 } as const;

export function loadSystemSettings(db: DatabaseExecutor): SystemSettingsView {
	const row = db.select().from(systemSettings).where(eq(systemSettings.id, 1)).get();

	if (!row) {
		throw new Error('The system settings row is missing');
	}

	return {
		siteName: row.siteName,
		publicSiteEnabled: row.publicSiteEnabled,
		defaultContentLanguage: defaultLanguageCode(db) ?? '',
		requireTwoFactorForAdmins: row.requireTwoFactorForAdmins,
		defaultApiRateLimit: row.defaultApiRateLimit,
		revisionRetention: row.revisionRetention,
		updatedAt: row.updatedAt
	};
}

export async function updateSystemSettings(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: SystemSettingsValues,
	confirmation: ProtectedActionInput
): Promise<SettingsUpdateResult> {
	requirePermission(actor, 'settings.manage', null);

	const language = runtime.db
		.select({ code: contentLanguages.code })
		.from(contentLanguages)
		.where(
			and(
				eq(contentLanguages.code, input.defaultContentLanguage),
				eq(contentLanguages.enabled, true)
			)
		)
		.get();

	if (!language) {
		return 'unknown_language';
	}

	const current = loadSystemSettings(runtime.db);
	const changes = changedValues(current, input);

	if (Object.keys(changes).length === 0) {
		return 'unchanged';
	}

	const verification = await reauthenticate(runtime, request, actor, confirmation);

	if (verification !== 'verified') {
		return verification;
	}

	runtime.db.transaction((tx) => {
		tx.update(systemSettings)
			.set({
				siteName: input.siteName,
				publicSiteEnabled: input.publicSiteEnabled,
				requireTwoFactorForAdmins: input.requireTwoFactorForAdmins,
				defaultApiRateLimit: input.defaultApiRateLimit,
				revisionRetention: input.revisionRetention,
				updatedBy: actor.id,
				updatedAt: new Date()
			})
			.where(eq(systemSettings.id, 1))
			.run();

		if (current.defaultContentLanguage !== input.defaultContentLanguage) {
			makeDefaultLanguage(tx, input.defaultContentLanguage);
		}

		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'settings.updated',
			targetType: 'settings',
			details: { changes },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'updated';
}

function changedValues(
	current: SystemSettingsValues,
	next: SystemSettingsValues
): Partial<SystemSettingsValues> {
	const changes: Partial<SystemSettingsValues> = {};

	if (current.siteName !== next.siteName) {
		changes.siteName = next.siteName;
	}

	if (current.publicSiteEnabled !== next.publicSiteEnabled) {
		changes.publicSiteEnabled = next.publicSiteEnabled;
	}

	if (current.defaultContentLanguage !== next.defaultContentLanguage) {
		changes.defaultContentLanguage = next.defaultContentLanguage;
	}

	if (current.requireTwoFactorForAdmins !== next.requireTwoFactorForAdmins) {
		changes.requireTwoFactorForAdmins = next.requireTwoFactorForAdmins;
	}

	if (current.defaultApiRateLimit !== next.defaultApiRateLimit) {
		changes.defaultApiRateLimit = next.defaultApiRateLimit;
	}

	if (current.revisionRetention !== next.revisionRetention) {
		changes.revisionRetention = next.revisionRetention;
	}

	return changes;
}
