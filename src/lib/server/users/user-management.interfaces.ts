import type { ManagedRole, UserRole, UserStatus } from '../../constants/users';
import type { ReauthenticationFailure } from '../auth/two-factor-settings.interfaces';

export interface ManagedUser {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	canPublishDirectly: boolean;
	twoFactorEnabled: boolean;
	status: UserStatus;
	createdAt: Date;
}

export interface ManagedUserRow {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	canPublishDirectly: boolean;
	twoFactorEnabled: boolean | null;
	deactivatedAt: Date | null;
	createdAt: Date;
	hasPassword: boolean;
}

export interface InviteInput {
	email: string;
	name: string;
	role: ManagedRole;
}

export type InviteResult =
	{ status: 'invited'; userId: string; link: string } | { status: 'email_taken' };

export type LinkResult =
	{ status: 'created'; link: string } | { status: 'not_found' } | { status: 'not_applicable' };

export type UserUpdateResult = 'updated' | 'unchanged' | 'not_found';

export type RoleChangeResult = UserUpdateResult | ReauthenticationFailure;
