import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, flag, updatedAt } from './columns';

export const contentLanguages = sqliteTable(
	'content_languages',
	{
		code: text('code').primaryKey(),
		name: text('name').notNull(),
		nativeName: text('native_name').notNull(),
		enabled: flag('enabled').notNull().default(true),
		isDefault: flag('is_default').notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('content_languages_single_default')
			.on(table.isDefault)
			.where(sql`is_default = 1`),
		check('content_languages_default_enabled', sql`is_default = 0 or enabled = 1`)
	]
);
