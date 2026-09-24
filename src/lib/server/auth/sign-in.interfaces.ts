export interface PasswordCredentials {
	email: string;
	password: string;
}

export type TwoFactorMethod = 'totp' | 'backup_code';

export interface TwoFactorCode {
	method: TwoFactorMethod;
	code: string;
}

export type PasswordSignInResult =
	| { status: 'signed_in' }
	| { status: 'two_factor_required' }
	| { status: 'invalid_credentials' }
	| { status: 'locked' }
	| { status: 'rate_limited'; retryAfterSeconds: number };

export type TwoFactorSignInResult =
	| { status: 'signed_in' }
	| { status: 'invalid_code' }
	| { status: 'locked' }
	| { status: 'challenge_expired' }
	| { status: 'rate_limited'; retryAfterSeconds: number };
