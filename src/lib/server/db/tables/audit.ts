import { sql } from 'drizzle-orm';
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { AUDIT_ACTOR_TYPES } from '../../../constants/audit';
import { user } from '../auth.schema';
import { createdAt, uuidPrimaryKey } from './columns';

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: uuidPrimaryKey(),
		actorType: text('actor_type', { enum: AUDIT_ACTOR_TYPES }).notNull(),
		actorId: text('actor_id').references(() => user.id),
		ip: text('ip'),
		userAgent: text('user_agent'),
		action: text('action').notNull(),
		targetType: text('target_type'),
		targetId: text('target_id'),
		details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
		createdAt: createdAt()
	},
	(table) => [
		index('audit_log_created').on(table.createdAt),
		index('audit_log_actor').on(table.actorId, table.createdAt),
		index('audit_log_action').on(table.action, table.createdAt),
		index('audit_log_target').on(table.targetType, table.targetId),
		check('audit_log_actor_type', sql`actor_type in ('user', 'anonymous', 'cli', 'system')`),
		check('audit_log_actor', sql`(actor_type = 'user') = (actor_id is not null)`)
	]
);
