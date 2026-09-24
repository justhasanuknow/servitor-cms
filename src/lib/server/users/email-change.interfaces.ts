import type { ReauthenticationResult } from '../auth/reauthentication.interfaces';

export type EmailChangeResult =
	| 'changed'
	| 'verification_sent'
	| 'unchanged'
	| 'email_taken'
	| 'email_failed'
	| Exclude<ReauthenticationResult, 'verified'>;

export type EmailChangeConfirmation = 'changed' | 'invalid_link' | 'email_taken';

export interface EmailChangePreview {
	newEmail: string;
}
