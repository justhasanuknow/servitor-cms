export const AUDIT_ACTOR_TYPES = ['user', 'anonymous', 'cli', 'system'] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_ACTIONS = [
	'auth.login_succeeded',
	'auth.login_failed',
	'auth.account_locked',
	'auth.logout',
	'auth.password_changed',
	'auth.founder_reset',
	'auth.two_factor_enabled',
	'auth.two_factor_disabled',
	'auth.backup_codes_regenerated',
	'auth.session_revoked',
	'user.created'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
