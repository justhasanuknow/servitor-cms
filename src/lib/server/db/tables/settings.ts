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

export const backupSchedule = sqliteTable(
	'backup_schedule',
	{
		id: integer('id').primaryKey(),
		frequency: text('frequency', { enum: ['off', 'daily', 'weekly'] })
			.notNull()
			.default('off'),
		hour: integer('hour').notNull().default(3),
		retention: integer('retention').notNull().default(7),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		updatedAt: updatedAt()
	},
	() => [
		check('backup_schedule_singleton', sql`id = 1`),
		check('backup_schedule_frequency', sql`frequency in ('off', 'daily', 'weekly')`),
		check('backup_schedule_hour', sql`hour between 0 and 23`),
		check('backup_schedule_retention', sql`retention between 1 and 365`)
	]
);
