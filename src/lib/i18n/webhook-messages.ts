import type { WebhookDeliveryStatus, WebhookEvent } from '$lib/constants/webhooks';
import { m } from '$lib/paraglide/messages';
import { reauthenticationMessage } from './auth-messages';

export function webhookEventDescription(event: WebhookEvent): string {
	switch (event) {
		case 'post.published':
			return m.webhooks_event_published();
		case 'post.updated':
			return m.webhooks_event_updated();
		case 'post.unpublished':
			return m.webhooks_event_unpublished();
		case 'post.hidden':
			return m.webhooks_event_hidden();
		case 'post.unhidden':
			return m.webhooks_event_unhidden();
		default:
			return m.webhooks_event_deleted();
	}
}

export function deliveryStatusLabel(status: WebhookDeliveryStatus): string {
	switch (status) {
		case 'succeeded':
			return m.webhooks_delivery_succeeded();
		case 'failed':
			return m.webhooks_delivery_failed();
		case 'delivering':
			return m.webhooks_delivery_delivering();
		default:
			return m.webhooks_delivery_pending();
	}
}

export function webhookErrorMessage(error: string | undefined): string | null {
	switch (error) {
		case 'invalid_url':
			return m.webhooks_error_url();
		case 'no_events':
			return m.webhooks_error_events();
		case 'too_many':
			return m.webhooks_error_too_many();
		default:
			return reauthenticationMessage(error);
	}
}
