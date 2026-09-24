import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, contentLanguages } from '../db/schema';
import {
	addContentLanguage,
	defaultLanguageCode,
	ensureDefaultContentLanguage,
	setContentLanguageEnabled
} from '../languages/languages';
import { createLogger } from '../logging/logger';
import { createTestRuntime } from '../testing/runtime';
import { loadSystemSettings, updateSystemSettings } from './system-settings';
import type { SystemSettingsValues } from './system-settings.interfaces';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(async () => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
	await harness.createUser({ email: 'founder@example.com', password: PASSWORD, role: 'founder' });
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
});

afterEach(() => {
	harness.dispose();
});

function values(overrides: Partial<SystemSettingsValues> = {}): SystemSettingsValues {
	const current = loadSystemSettings(harness.runtime.db);

	return {
		siteName: current.siteName,
		publicSiteEnabled: current.publicSiteEnabled,
		defaultContentLanguage: current.defaultContentLanguage,
		requireTwoFactorForAdmins: current.requireTwoFactorForAdmins,
		defaultApiRateLimit: current.defaultApiRateLimit,
		revisionRetention: current.revisionRetention,
		...overrides
	};
}

describe('system settings', () => {
	it('lets the founder change settings after re-authentication', async () => {
		const founder = await harness.signIn('founder@example.com', PASSWORD);

		addContentLanguage(harness.runtime, harness.request(founder.jar), founder.actor, {
			code: 'tr',
			name: null,
			nativeName: null,
			sortOrder: 0
		});

		expect(
			await updateSystemSettings(
				harness.runtime,
				harness.request(founder.jar, '192.0.2.1'),
				founder.actor,
				values({
					siteName: 'Field Notes',
					defaultContentLanguage: 'tr',
					revisionRetention: 20
				}),
				{ password: 'not-the-password', totpCode: null }
			)
		).toBe('invalid_password');
		expect(loadSystemSettings(harness.runtime.db).siteName).toBe('Servitor CMS');
		expect(
			await updateSystemSettings(
				harness.runtime,
				harness.request(founder.jar, '192.0.2.2'),
				founder.actor,
				values({
					siteName: 'Field Notes',
					defaultContentLanguage: 'tr',
					revisionRetention: 20
				}),
				{ password: PASSWORD, totpCode: null }
			)
		).toBe('updated');
		expect(loadSystemSettings(harness.runtime.db)).toMatchObject({
			siteName: 'Field Notes',
			defaultContentLanguage: 'tr',
			revisionRetention: 20
		});
		expect(defaultLanguageCode(harness.runtime.db)).toBe('tr');
		expect(
			harness.runtime.db
				.select()
				.from(contentLanguages)
				.where(eq(contentLanguages.isDefault, true))
				.all()
		).toHaveLength(1);
		expect(
			harness.runtime.db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, 'settings.updated'))
				.all()
		).toMatchObject([
			{
				details: {
					changes: {
						siteName: 'Field Notes',
						defaultContentLanguage: 'tr',
						revisionRetention: 20
					}
				}
			}
		]);
	});

	it('reports unchanged settings without asking for the password', async () => {
		const founder = await harness.signIn('founder@example.com', PASSWORD);

		expect(
			await updateSystemSettings(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				values(),
				{ password: '', totpCode: null }
			)
		).toBe('unchanged');
	});

	it('requires an enabled default language', async () => {
		const founder = await harness.signIn('founder@example.com', PASSWORD);

		addContentLanguage(harness.runtime, harness.request(founder.jar), founder.actor, {
			code: 'fr',
			name: null,
			nativeName: null,
			sortOrder: 0
		});
		setContentLanguageEnabled(
			harness.runtime,
			harness.request(founder.jar),
			founder.actor,
			'fr',
			false
		);

		expect(
			await updateSystemSettings(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				values({ defaultContentLanguage: 'fr' }),
				{ password: PASSWORD, totpCode: null }
			)
		).toBe('unknown_language');
	});

	it('is reserved for the founder', async () => {
		const admin = await harness.signIn('admin@example.com', PASSWORD);

		await expect(
			updateSystemSettings(
				harness.runtime,
				harness.request(admin.jar),
				admin.actor,
				values({ siteName: 'Admin Site' }),
				{ password: PASSWORD, totpCode: null }
			)
		).rejects.toMatchObject({ status: 403 });
	});
});
