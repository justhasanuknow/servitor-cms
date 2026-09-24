import type { UserRole, UserStatus } from '$lib/constants/users';
import { m } from '$lib/paraglide/messages';

export function roleLabel(role: UserRole): string {
	switch (role) {
		case 'founder':
			return m.role_founder();
		case 'admin':
			return m.role_admin();
		default:
			return m.role_author();
	}
}

export function userStatusLabel(status: UserStatus): string {
	switch (status) {
		case 'active':
			return m.status_active();
		case 'invited':
			return m.status_invited();
		default:
			return m.status_deactivated();
	}
}
