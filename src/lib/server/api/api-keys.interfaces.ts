import type { ReauthenticationResult } from '../auth/reauthentication.interfaces';

export interface ApiKeyInput {
	name: string;
	languages: string[] | null;
	categories: string[] | null;
	expiresAt: Date | null;
	rateLimitPerMinute: number | null;
}

export type ApiKeyCreateResult =
	| { status: 'created'; id: string; key: string }
	| { status: Exclude<ReauthenticationResult, 'verified'> }
	| { status: 'unknown_language' | 'unknown_category' | 'invalid_expiry' };

export type ApiKeyRevokeResult =
	'revoked' | 'not_found' | 'already_revoked' | Exclude<ReauthenticationResult, 'verified'>;

export type ApiKeyStatus = 'active' | 'expired' | 'revoked';

export interface ApiKeyView {
	id: string;
	name: string;
	prefix: string;
	status: ApiKeyStatus;
	languages: string[] | null;
	categories: string[] | null;
	rateLimitPerMinute: number | null;
	expiresAt: Date | null;
	lastUsedAt: Date | null;
	revokedAt: Date | null;
	createdAt: Date;
	createdByName: string;
}

export interface ApiKeyContext {
	id: string;
	rateLimitPerMinute: number | null;
	languages: string[] | null;
	categories: string[] | null;
}
