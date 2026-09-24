import { sql } from 'drizzle-orm';
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { THEME_MODES, THEME_PALETTES, UI_LOCALES } from '../../../constants/preferences';
import { USER_TOKEN_TYPES } from '../../../constants/users';
import { user } from '../auth.schema';
import { createdAt, timestamp, updatedAt, uuidPrimaryKey } from './columns';
import { media } from './media';

export const userProfiles = sqliteTable(
	'user_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		bio: text('bio'),
		avatarMediaId: text('avatar_media_id').references(() => media.id),
		uiLocale: text('ui_locale', { enum: UI_LOCALES }),
		themePalette: text('theme_palette', { enum: THEME_PALETTES }).notNull().default('neutral'),
		themeMode: text('theme_mode', { enum: THEME_MODES }).notNull().default('system'),
		updatedAt: updatedAt()
	},
	(table) => [
		index('user_profiles_avatar').on(table.avatarMediaId),
		check(
			'user_profiles_ui_locale',
			sql`ui_locale is null or ui_locale in ('en', 'tr', 'fr', 'de', 'ja', 'zh-Hans')`
		),
		check(
			'user_profiles_theme_palette',
			sql`theme_palette in ('neutral', 'red', 'blue', 'green', 'pink')`
		),
		check('user_profiles_theme_mode', sql`theme_mode in ('light', 'dark', 'system')`)
	]
);

export const userTokens = sqliteTable(
	'user_tokens',
	{
		id: uuidPrimaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type', { enum: USER_TOKEN_TYPES }).notNull(),
		tokenHash: text('token_hash').notNull().unique(),
		newEmail: text('new_email'),
		expiresAt: timestamp('expires_at').notNull(),
		usedAt: timestamp('used_at'),
		createdBy: text('created_by').references(() => user.id),
		createdAt: createdAt()
	},
	(table) => [
		index('user_tokens_user_type').on(table.userId, table.type),
		check('user_tokens_type', sql`type in ('invite', 'password_reset', 'email_change')`),
		check('user_tokens_new_email', sql`(type = 'email_change') = (new_email is not null)`)
	]
);
