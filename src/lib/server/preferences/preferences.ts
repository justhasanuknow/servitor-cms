import { eq } from 'drizzle-orm';
import { THEME_MODES, THEME_PALETTES, type UiLocale } from '../../constants/preferences';
import type { AppDatabase } from '../db';
import { user, userProfiles } from '../db/schema';
import type {
	ProfileInput,
	ProfileView,
	ThemeChoice,
	UserPreferences
} from './preferences.interfaces';

export const DEFAULT_THEME: ThemeChoice = { palette: 'neutral', mode: 'system' };

const THEME_SEPARATOR = '.';

export function loadPreferences(db: AppDatabase, userId: string): UserPreferences {
	const row = db
		.select({
			uiLocale: userProfiles.uiLocale,
			themePalette: userProfiles.themePalette,
			themeMode: userProfiles.themeMode
		})
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.get();

	if (!row) {
		return { uiLocale: null, theme: DEFAULT_THEME };
	}

	return {
		uiLocale: row.uiLocale,
		theme: { palette: row.themePalette, mode: row.themeMode }
	};
}

export function loadProfile(db: AppDatabase, userId: string): ProfileView | null {
	const row = db
		.select({ name: user.name, email: user.email, bio: userProfiles.bio })
		.from(user)
		.leftJoin(userProfiles, eq(userProfiles.userId, user.id))
		.where(eq(user.id, userId))
		.get();

	if (!row) {
		return null;
	}

	return {
		name: row.name,
		email: row.email,
		bio: row.bio ?? '',
		preferences: loadPreferences(db, userId)
	};
}

export function updateProfile(db: AppDatabase, userId: string, input: ProfileInput): void {
	const now = new Date();

	db.transaction((tx) => {
		tx.update(user).set({ name: input.name, updatedAt: now }).where(eq(user.id, userId)).run();
		tx.insert(userProfiles)
			.values({
				userId,
				bio: input.bio,
				uiLocale: input.uiLocale,
				themePalette: input.themePalette,
				themeMode: input.themeMode,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: userProfiles.userId,
				set: {
					bio: input.bio,
					uiLocale: input.uiLocale,
					themePalette: input.themePalette,
					themeMode: input.themeMode,
					updatedAt: now
				}
			})
			.run();
	});
}

export function setUiLocale(db: AppDatabase, userId: string, uiLocale: UiLocale | null): void {
	const now = new Date();

	db.insert(userProfiles)
		.values({ userId, uiLocale, updatedAt: now })
		.onConflictDoUpdate({ target: userProfiles.userId, set: { uiLocale, updatedAt: now } })
		.run();
}

export function serializeTheme(theme: ThemeChoice): string {
	return `${theme.palette}${THEME_SEPARATOR}${theme.mode}`;
}

export function parseTheme(value: string | undefined): ThemeChoice | null {
	if (value === undefined) {
		return null;
	}

	const parts = value.split(THEME_SEPARATOR);

	if (parts.length !== 2) {
		return null;
	}

	const [palette, mode] = parts;
	const knownPalette = THEME_PALETTES.find((candidate) => candidate === palette);
	const knownMode = THEME_MODES.find((candidate) => candidate === mode);

	if (knownPalette === undefined || knownMode === undefined) {
		return null;
	}

	return { palette: knownPalette, mode: knownMode };
}

export function panelTheme(
	preferences: UserPreferences | null,
	cookieValue: string | undefined
): ThemeChoice {
	if (preferences !== null) {
		return preferences.theme;
	}

	return parseTheme(cookieValue) ?? DEFAULT_THEME;
}
