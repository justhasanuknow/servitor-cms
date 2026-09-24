import type { ReauthenticationResult } from './reauthentication.interfaces';

export type SessionRevokeResult =
	'revoked' | 'not_found' | Exclude<ReauthenticationResult, 'verified'>;

export type OtherSessionsRevokeResult =
	{ status: 'revoked'; count: number } | { status: Exclude<ReauthenticationResult, 'verified'> };

export interface SessionSummary {
	id: string;
	current: boolean;
	browser: string | null;
	os: string | null;
	ipAddress: string | null;
	createdAt: Date;
	lastActiveAt: Date;
}
