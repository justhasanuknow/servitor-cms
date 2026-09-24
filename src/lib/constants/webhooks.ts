export const WEBHOOK_EVENTS = [
	'post.published',
	'post.updated',
	'post.unpublished',
	'post.hidden',
	'post.unhidden',
	'post.deleted'
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'delivering', 'succeeded', 'failed'] as const;

export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export const WEBHOOK_URL_MAX_LENGTH = 2_048;

export const WEBHOOK_SECRET_PREFIX = 'whsec_';

export const WEBHOOK_SECRET_BYTES = 32;

export const WEBHOOK_TIMEOUT_MS = 10_000;

export const WEBHOOK_MAX_RETRIES = 5;

export const WEBHOOK_RETRY_BASE_MS = 30_000;

export const WEBHOOK_WORKER_INTERVAL_MS = 5_000;

export const WEBHOOK_BATCH_SIZE = 10;

export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export const WEBHOOK_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const WEBHOOK_ERROR_MAX_LENGTH = 500;

export const WEBHOOK_DELIVERIES_SHOWN = 50;

export const MAX_WEBHOOKS = 50;
