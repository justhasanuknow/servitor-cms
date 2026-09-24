import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { webhookDeliveries, webhooks } from '../db/schema';
import { createTestRuntime } from '../testing/runtime';
import { enqueuePostEvent } from './outbox';

let harness: ReturnType<typeof createTestRuntime>;

let creator: string;

beforeEach(async () => {
	harness = createTestRuntime();
	creator = await harness.createUser({
		email: 'founder@example.com',
		password: 'Kx7-quiet-harbor-19',
		role: 'founder'
	});
});

afterEach(() => {
	harness.dispose();
});

function webhook(events: ('post.published' | 'post.deleted')[], enabled = true): void {
	harness.runtime.db
		.insert(webhooks)
		.values({
			url: 'https://hooks.example.com',
			events,
			enabled,
			secretCiphertext: 'test',
			createdBy: creator
		})
		.run();
}

describe('enqueuePostEvent', () => {
	it('queues one delivery per enabled webhook subscribed to the event', () => {
		webhook(['post.published']);
		webhook(['post.published', 'post.deleted']);
		webhook(['post.deleted']);
		webhook(['post.published'], false);

		const now = new Date('2026-09-24T12:00:00.000Z');
		const queued = enqueuePostEvent(
			harness.runtime.db,
			'post.published',
			{ postId: 'post-1', translations: [{ languageCode: 'en', slug: 'hello' }] },
			now
		);
		const deliveries = harness.runtime.db.select().from(webhookDeliveries).all();

		expect(queued).toBe(2);
		expect(deliveries).toHaveLength(2);
		expect(deliveries.every((delivery) => delivery.status === 'pending')).toBe(true);
		expect(JSON.parse(deliveries[0].payload)).toEqual({
			event: 'post.published',
			delivery_id: deliveries[0].id,
			timestamp: '2026-09-24T12:00:00.000Z',
			post_id: 'post-1',
			languages: ['en'],
			slugs: { en: 'hello' }
		});
	});

	it('does nothing without subscribers', () => {
		expect(
			enqueuePostEvent(harness.runtime.db, 'post.deleted', { postId: 'x', translations: [] })
		).toBe(0);
	});
});
