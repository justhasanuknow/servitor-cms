import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from '../auth.schema';
import { flag, updatedAt } from './columns';

export const systemSettings = sqliteTable(
	'system_settings',
	{
		id: integer('id').primaryKey(),
		siteName: text('site_name').notNull().default('Servitor CMS'),
		publicSiteEnabled: flag('public_site_enabled').notNull().default(true),
		requireTwoFactorForAdmins: flag('require_two_factor_for_admins').notNull().default(false),
		defaultApiRateLimit: integer('default_api_rate_limit').notNull().default(120),
		revisionRetention: integer('revision_retention').notNull().default(50),
		updatedBy: text('updated_by').references(() => user.id),
		updatedAt: updatedAt()
	},
	() => [
		check('system_settings_singleton', sql`id = 1`),
		check('system_settings_api_rate_limit', sql`default_api_rate_limit > 0`),
		check('system_settings_revision_retention', sql`revision_retention > 0`)
	]
);
