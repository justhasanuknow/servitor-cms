import type { AuthRequest } from '../auth/auth-request.interfaces';
import type { PasswordPolicyViolation } from '../auth/password-policy';
import type { Runtime } from '../runtime.interfaces';

export interface AccountLinkOwner {
	name: string;
	email: string;
}

export type AccountLinkResult = 'completed' | 'invalid_link' | 'mismatch' | PasswordPolicyViolation;

export interface NewPasswordInput {
	password: string;
	confirmation: string;
}

export type AccountLinkCompleter = (
	runtime: Runtime,
	request: AuthRequest,
	token: string,
	input: NewPasswordInput
) => Promise<AccountLinkResult>;
