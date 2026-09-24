import { z } from 'zod';
import { WEBHOOK_EVENTS, WEBHOOK_URL_MAX_LENGTH } from '../../constants/webhooks';
import { optionalCodeField, passwordField } from '../auth/form-fields';
import type { ReauthenticationInput } from '../auth/reauthentication.interfaces';
import { formFields, formList } from '../http/form';
import type { WebhookInput } from './webhooks.interfaces';

const checkbox = z
	.literal('on')
	.optional()
	.transform((value) => value === 'on');

const webhookSchema = z.object({
	url: z.string().max(WEBHOOK_URL_MAX_LENGTH),
	enabled: checkbox
});

const eventsSchema = z.array(z.enum(WEBHOOK_EVENTS));

const confirmationSchema = z.object({ password: passwordField, totpCode: optionalCodeField });

export function readWebhookInput(data: FormData): WebhookInput | null {
	const fields = webhookSchema.safeParse(formFields(data));
	const events = eventsSchema.safeParse(formList(data, 'events', WEBHOOK_EVENTS.length));

	if (!fields.success || !events.success) {
		return null;
	}

	return { url: fields.data.url, events: events.data, enabled: fields.data.enabled };
}

export function readConfirmation(data: FormData): ReauthenticationInput | null {
	const parsed = confirmationSchema.safeParse(formFields(data));

	if (!parsed.success) {
		return null;
	}

	return parsed.data;
}
