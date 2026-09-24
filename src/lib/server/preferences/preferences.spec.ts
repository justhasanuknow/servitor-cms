import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { user, userProfiles } from '../db/schema';
import { createTestDatabase } from '../testing/database';
import {
	DEFAULT_THEME,
	loadPreferences,
	loadProfile,
	panelTheme,
	parseTheme,
	serializeTheme,
	updateProfile
} from './preferences';

let database: ReturnType<typeof createTestDatabase>;

beforeEach(() => {
	database = createTestDatabase();
	database.db
		.insert(user)
		.values({ id: 'user-1', name: 'Ada', email: 'ada@example.com', role: 'author' })
		.run();
});

afterEach(() => {
	database.dispose();
});

describe('profiles and preferences', () => {
	it('uses the defaults when no profile row exists', () => {
		expect(loadPreferences(database.db, 'user-1')).toEqual({
			uiLocale: null,
			theme: DEFAULT_THEME
		});
		expect(loadProfile(database.db, 'user-1')).toMatchObject({ name: 'Ada', bio: '' });
	});

	it('saves the display name, bio, UI language and theme', () => {
		updateProfile(database.db, 'user-1', {
			name: 'Ada Lovelace',
			bio: 'Analyst',
			uiLocale: 'ja',
			themePalette: 'green',
			themeMode: 'dark'
		});
		updateProfile(database.db, 'user-1', {
			name: 'Ada Lovelace',
			bio: 'Analytical engine',
			uiLocale: null,
			themePalette: 'pink',
			themeMode: 'light'
		});

		expect(loadProfile(database.db, 'user-1')).toEqual({
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			bio: 'Analytical engine',
			preferences: { uiLocale: null, theme: { palette: 'pink', mode: 'light' } }
		});
		expect(database.db.select().from(userProfiles).all()).toHaveLength(1);
	});
});

describe('theme cookie', () => {
	it('round-trips a theme choice', () => {
		expect(parseTheme(serializeTheme({ palette: 'blue', mode: 'dark' }))).toEqual({
			palette: 'blue',
			mode: 'dark'
		});
	});

	it.each([undefined, '', 'blue', 'purple.dark', 'blue.dim', 'blue.dark.extra'])(
		'rejects %s',
		(value) => {
			expect(parseTheme(value)).toBeNull();
		}
	);

	it('prefers the saved preference over the cookie', () => {
		expect(
			panelTheme({ uiLocale: null, theme: { palette: 'red', mode: 'light' } }, 'blue.dark')
		).toEqual({ palette: 'red', mode: 'light' });
		expect(panelTheme(null, 'blue.dark')).toEqual({ palette: 'blue', mode: 'dark' });
		expect(panelTheme(null, 'garbage')).toEqual(DEFAULT_THEME);
	});
});
