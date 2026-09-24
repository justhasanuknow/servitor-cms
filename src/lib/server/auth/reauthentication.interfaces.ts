export interface ReauthenticationInput {
	password: string;
	totpCode: string | null;
}

export type ReauthenticationResult =
	'verified' | 'rate_limited' | 'invalid_password' | 'missing_code' | 'invalid_code';
