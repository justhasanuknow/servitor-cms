import { eq } from 'drizzle-orm';
import type { WebhookEvent } from '../../constants/webhooks';
import type { DatabaseExecutor } from '../db';
import { webhookDeliveries, webhooks } from '../db/schema';
import type { PostEventTarget } from './outbox.interfaces';

export function enqueuePostEvent(
	tx: DatabaseExecutor,
	event: WebhookEvent,
	target: PostEventTarget,
	now: Date = new Date()
): number {
	const subscribers = tx
		.select({ id: webhooks.id, events: webhooks.events })
		.from(webhooks)
		.where(eq(webhooks.enabled, true))
		.all()
		.filter((webhook) => webhook.events.includes(event));

	for (const subscriber of subscribers) {
		const id = crypto.randomUUID();
		const payload = JSON.stringify({
			event,
			delivery_id: id,
			timestamp: now.toISOString(),
			post_id: target.postId,
			languages: target.translations.map((translation) => translation.languageCode),
			slugs: Object.fromEntries(
				target.translations.map((translation) => [
					translation.languageCode,
					translation.slug
				])
			)
		});

		tx.insert(webhookDeliveries)
			.values({
				id,
				webhookId: subscriber.id,
				event,
				payload,
				status: 'pending',
				nextAttemptAt: now,
				createdAt: now
			})
			.run();
	}

	return subscribers.length;
}
