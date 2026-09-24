import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from '../auth.schema';
import { categories } from './categories';
import { createdAt, flag, timestamp, uuidPrimaryKey } from './columns';
import { contentLanguages } from './languages';

export const apiKeys = sqliteTable(
	'api_keys',
	{
		id: uuidPrimaryKey(),
		name: text('name').notNull(),
		keyPrefix: text('key_prefix').notNull(),
		keyHash: text('key_hash').notNull().unique(),
		allLanguages: flag('all_languages').notNull().default(true),
		allCategories: flag('all_categories').notNull().default(true),
		rateLimitPerMinute: integer('rate_limit_per_minute'),
		expiresAt: timestamp('expires_at'),
		lastUsedAt: timestamp('last_used_at'),
		revokedAt: timestamp('revoked_at'),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		createdAt: createdAt()
	},
	(table) => [
		index('api_keys_prefix').on(table.keyPrefix),
		check(
			'api_keys_rate_limit',
			sql`rate_limit_per_minute is null or rate_limit_per_minute > 0`
		)
	]
);

export const apiKeyLanguages = sqliteTable(
	'api_key_languages',
	{
		apiKeyId: text('api_key_id')
			.notNull()
			.references(() => apiKeys.id, { onDelete: 'cascade' }),
		languageCode: text('language_code')
			.notNull()
			.references(() => contentLanguages.code, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.apiKeyId, table.languageCode] })]
);

export const apiKeyCategories = sqliteTable(
	'api_key_categories',
	{
		apiKeyId: text('api_key_id')
			.notNull()
			.references(() => apiKeys.id, { onDelete: 'cascade' }),
		categoryId: text('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.apiKeyId, table.categoryId] })]
);

export const corsOrigins = sqliteTable('cors_origins', {
	id: uuidPrimaryKey(),
	origin: text('origin').notNull().unique(),
	createdBy: text('created_by')
		.notNull()
		.references(() => user.id),
	createdAt: createdAt()
});
