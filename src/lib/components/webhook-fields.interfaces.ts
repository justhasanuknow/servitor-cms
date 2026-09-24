import type { WebhookEvent } from '$lib/constants/webhooks';

export interface WebhookFieldsProps {
	idPrefix: string;
	url?: string;
	events?: WebhookEvent[];
	enabled?: boolean;
}
