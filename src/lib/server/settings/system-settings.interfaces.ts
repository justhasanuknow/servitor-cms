import type { ReauthenticationFailure } from '../auth/two-factor-settings.interfaces';

export interface SystemSettingsValues {
	siteName: string;
	publicSiteEnabled: boolean;
	defaultContentLanguage: string;
	requireTwoFactorForAdmins: boolean;
	defaultApiRateLimit: number;
	revisionRetention: number;
}

export interface SystemSettingsView extends SystemSettingsValues {
	updatedAt: Date;
}

export type SettingsUpdateResult =
	'updated' | 'unchanged' | 'unknown_language' | ReauthenticationFailure;
