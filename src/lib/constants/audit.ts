export const AUDIT_ACTOR_TYPES = ['user', 'anonymous', 'cli', 'system'] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_ACTIONS = [
	'auth.login_succeeded',
	'auth.login_failed',
	'auth.account_locked',
	'auth.logout',
	'auth.password_changed',
	'auth.password_reset',
	'auth.founder_reset',
	'auth.two_factor_enabled',
	'auth.two_factor_disabled',
	'auth.backup_codes_regenerated',
	'auth.session_revoked',
	'user.created',
	'user.invited',
	'user.invite_link_created',
	'user.invite_accepted',
	'user.password_reset_link_created',
	'user.role_changed',
	'user.deactivated',
	'user.reactivated',
	'user.publish_permission_changed',
	'language.added',
	'language.updated',
	'language.enabled',
	'language.disabled',
	'language.deleted',
	'category.created',
	'category.updated',
	'category.deleted',
	'post.deleted',
	'settings.updated'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
