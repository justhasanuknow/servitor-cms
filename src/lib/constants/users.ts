export const USER_ROLES = ['founder', 'admin', 'author'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const MANAGED_ROLES = ['admin', 'author'] as const;

export type ManagedRole = (typeof MANAGED_ROLES)[number];

export const USER_STATUSES = ['active', 'invited', 'deactivated'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_TOKEN_TYPES = ['invite', 'password_reset', 'email_change'] as const;

export type UserTokenType = (typeof USER_TOKEN_TYPES)[number];
