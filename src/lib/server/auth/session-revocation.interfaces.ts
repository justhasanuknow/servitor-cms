export type SessionRevocationResult =
	{ status: 'revoked'; count: number } | { status: 'unknown_user' };
