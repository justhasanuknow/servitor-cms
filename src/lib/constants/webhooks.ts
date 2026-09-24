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
