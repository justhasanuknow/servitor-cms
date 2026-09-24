import type { ThemeMode, ThemePalette } from '$lib/constants/preferences';
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

export function paletteLabel(palette: ThemePalette): string {
	switch (palette) {
		case 'red':
			return m.palette_red();
		case 'blue':
			return m.palette_blue();
		case 'green':
			return m.palette_green();
		case 'pink':
			return m.palette_pink();
		default:
			return m.palette_neutral();
	}
}

export function modeLabel(mode: ThemeMode): string {
	switch (mode) {
		case 'light':
			return m.mode_light();
		case 'dark':
			return m.mode_dark();
		default:
			return m.mode_system();
	}
}
