import type { ThemeMode, ThemePalette, UiLocale } from '../../constants/preferences';

export interface ThemeChoice {
	palette: ThemePalette;
	mode: ThemeMode;
}

export interface UserPreferences {
	uiLocale: UiLocale | null;
	theme: ThemeChoice;
}

export interface ProfileView {
	name: string;
	email: string;
	bio: string;
	preferences: UserPreferences;
}

export interface ProfileInput {
	name: string;
	bio: string | null;
	uiLocale: UiLocale | null;
	themePalette: ThemePalette;
	themeMode: ThemeMode;
}
