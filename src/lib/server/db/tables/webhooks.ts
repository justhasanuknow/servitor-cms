import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
	WEBHOOK_DELIVERY_STATUSES,
	WEBHOOK_EVENTS,
	type WebhookEvent
} from '../../../constants/webhooks';
import { user } from '../auth.schema';
import { createdAt, flag, timestamp, updatedAt, uuidPrimaryKey } from './columns';

export const webhooks = sqliteTable('webhooks', {
	id: uuidPrimaryKey(),
	url: text('url').notNull(),
	events: text('events', { mode: 'json' }).notNull().$type<WebhookEvent[]>(),
	enabled: flag('enabled').notNull().default(true),
	secretCiphertext: text('secret_ciphertext').notNull(),
	secretRotatedAt: timestamp('secret_rotated_at'),
	createdBy: text('created_by')
		.notNull()
		.references(() => user.id),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const webhookDeliveries = sqliteTable(
	'webhook_deliveries',
	{
		id: uuidPrimaryKey(),
		webhookId: text('webhook_id')
			.notNull()
			.references(() => webhooks.id, { onDelete: 'cascade' }),
		event: text('event', { enum: WEBHOOK_EVENTS }).notNull(),
		payload: text('payload').notNull(),
		status: text('status', { enum: WEBHOOK_DELIVERY_STATUSES }).notNull().default('pending'),
		attemptCount: integer('attempt_count').notNull().default(0),
		nextAttemptAt: timestamp('next_attempt_at'),
		completedAt: timestamp('completed_at'),
		createdAt: createdAt()
	},
	(table) => [
		index('webhook_deliveries_queue').on(table.status, table.nextAttemptAt),
		index('webhook_deliveries_webhook').on(table.webhookId, table.createdAt),
		check(
			'webhook_deliveries_event',
			sql`event in ('post.published', 'post.updated', 'post.unpublished', 'post.hidden', 'post.unhidden', 'post.deleted')`
		),
		check(
			'webhook_deliveries_status',
			sql`status in ('pending', 'delivering', 'succeeded', 'failed')`
		),
		check('webhook_deliveries_attempt_count', sql`attempt_count >= 0`)
	]
);

export const webhookDeliveryAttempts = sqliteTable(
	'webhook_delivery_attempts',
	{
		id: uuidPrimaryKey(),
		deliveryId: text('delivery_id')
			.notNull()
			.references(() => webhookDeliveries.id, { onDelete: 'cascade' }),
		statusCode: integer('status_code'),
		durationMs: integer('duration_ms').notNull(),
		error: text('error'),
		createdAt: createdAt()
	},
	(table) => [index('webhook_delivery_attempts_delivery').on(table.deliveryId, table.createdAt)]
);
