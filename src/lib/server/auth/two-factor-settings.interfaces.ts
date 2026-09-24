import type { ReauthenticationResult } from './reauthentication.interfaces';

export type ReauthenticationFailure = Exclude<ReauthenticationResult, 'verified'>;

export interface ProtectedActionInput {
	password: string;
	totpCode: string | null;
}

export interface TwoFactorEnrollment {
	totpUri: string;
	secret: string;
	backupCodes: string[];
}

export type EnrollmentStartResult =
	| { status: 'started'; enrollment: TwoFactorEnrollment }
	| { status: 'already_enabled' }
	| { status: ReauthenticationFailure };

export type EnrollmentConfirmResult = 'enabled' | 'invalid_code' | 'not_started' | 'rate_limited';

export type TwoFactorDisableResult = 'disabled' | 'not_enabled' | ReauthenticationFailure;

export type BackupCodeRegenerationResult =
	| { status: 'regenerated'; backupCodes: string[] }
	| { status: 'not_enabled' }
	| { status: ReauthenticationFailure };
