import type { ReauthenticationResult } from './reauthentication.interfaces';
import type { PasswordPolicyViolation } from './password-policy';

export interface PasswordChangeInput {
	currentPassword: string;
	newPassword: string;
	totpCode: string | null;
}

export type PasswordChangeResult =
	'changed' | 'reused' | PasswordPolicyViolation | Exclude<ReauthenticationResult, 'verified'>;
