import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_EVENTS } from '../../constants/webhooks';
import type { AuthUser } from '../auth/auth';
import { auditLog, webhookDeliveries, webhooks } from '../db/schema';
import { secretKeys } from '../security/secret-keys';
import type { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import {
	processDueDeliveries,
	pruneDeliveryLog,
	recoverInterruptedDeliveries,
	retryDelayMs
} from './delivery-worker';
import type { WebhookWorkerDependencies } from './delivery-worker.interfaces';
import { enqueuePostEvent } from './outbox';
import type { ResolvedAddress } from './safe-target.interfaces';
import { decryptSecret } from './secret-box';
import { verifySignature } from './signing';
import type { WebhookRequest, WebhookResponse } from './transport.interfaces';
import {
	createWebhook,
	deleteWebhook,
	listWebhookDeliveries,
	listWebhooks,
	normalizeWebhookUrl,
	rotateWebhookSecret,
	updateWebhook
} from './webhooks';

const PASSWORD = 'Kx7-quiet-harbor-19';

const START = new Date('2026-09-24T12:00:00.000Z');

let harness: ReturnType<typeof createTestRuntime>;

let admin: AuthUser;

let author: AuthUser;

let adminJar: TestCookieJar;

let authorJar: TestCookieJar;

beforeEach(async () => {
	harness = createTestRuntime();
	await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });
	await harness.createUser({ email: 'author@example.com', password: PASSWORD });

	const adminSession = await harness.signIn('admin@example.com', PASSWORD);
	const authorSession = await harness.signIn('author@example.com', PASSWORD);

	admin = adminSession.actor;
	adminJar = adminSession.jar;
	author = authorSession.actor;
	authorJar = authorSession.jar;
});

afterEach(() => {
	harness.dispose();
});

const CONFIRM = { password: PASSWORD, totpCode: null };

async function created(url = 'https://hooks.example.com/build') {
	const result = await createWebhook(
		harness.runtime,
		harness.request(adminJar),
		admin,
		{ url, events: [...WEBHOOK_EVENTS], enabled: true },
		CONFIRM
	);

	if (result.status !== 'created') {
		throw new Error(`Expected a webhook, got ${result.status}`);
	}

	return result;
}

function enqueue(event: 'post.published' | 'post.updated' = 'post.published') {
	return enqueuePostEvent(
		harness.runtime.db,
		event,
		{ postId: 'post-1', translations: [{ languageCode: 'en', slug: 'hello' }] },
		START
	);
}

function worker(
	answer: WebhookResponse | ((request: WebhookRequest) => WebhookResponse),
	addresses: ResolvedAddress[] = [{ address: '93.184.216.34', family: 4 }],
	now: Date = START
) {
	const send = vi.fn(async (request: WebhookRequest) => {
		if (typeof answer === 'function') {
			return answer(request);
		}

		return answer;
	});
	const dependencies: WebhookWorkerDependencies = {
		resolve: vi.fn(async () => addresses),
		send,
		now: () => now
	};

	return { dependencies, send };
}

function deliveries() {
	return harness.runtime.db.select().from(webhookDeliveries).all();
}

describe('webhook management', () => {
	it('creates webhooks with an encrypted secret that is shown once', async () => {
		const result = await created();
		const row = harness.runtime.db
			.select()
			.from(webhooks)
			.where(eq(webhooks.id, result.id))
			.get();

		expect(result.secret).toMatch(/^whsec_/);
		expect(row?.secretCiphertext).not.toContain(result.secret);
		expect(decryptSecret(row?.secretCiphertext ?? '', secretKeys(harness.runtime.env))).toBe(
			result.secret
		);
		expect(listWebhooks(harness.runtime.db)[0]).toMatchObject({
			url: 'https://hooks.example.com/build',
			enabled: true,
			pendingCount: 0
		});
		expect(JSON.stringify(listWebhooks(harness.runtime.db))).not.toContain(result.secret);
	});

	it('validates the address and the events', async () => {
		for (const url of [
			'http://hooks.example.com',
			'ftp://hooks.example.com',
			'https://user:pw@hooks.example.com',
			'https://hooks.example.com/#part',
			'not a url'
		]) {
			expect(
				await createWebhook(
					harness.runtime,
					harness.request(adminJar),
					admin,
					{ url, events: ['post.published'], enabled: true },
					CONFIRM
				)
			).toEqual({ status: 'invalid_url' });
		}

		expect(
			await createWebhook(
				harness.runtime,
				harness.request(adminJar),
				admin,
				{ url: 'https://hooks.example.com', events: [], enabled: true },
				CONFIRM
			)
		).toEqual({ status: 'no_events' });
		expect(normalizeWebhookUrl('http://build.internal/hook', true)).toBe(
			'http://build.internal/hook'
		);
	});

	it('requires the password to create a webhook or rotate its secret', async () => {
		expect(
			await createWebhook(
				harness.runtime,
				harness.request(adminJar),
				admin,
				{ url: 'https://hooks.example.com', events: ['post.published'], enabled: true },
				{ password: 'wrong-password-123', totpCode: null }
			)
		).toEqual({ status: 'invalid_password' });

		const webhook = await created();

		expect(
			await rotateWebhookSecret(
				harness.runtime,
				harness.request(adminJar),
				admin,
				webhook.id,
				{
					password: 'wrong-password-123',
					totpCode: null
				}
			)
		).toEqual({ status: 'invalid_password' });

		harness.advanceClock(10_000);

		const rotated = await rotateWebhookSecret(
			harness.runtime,
			harness.request(adminJar),
			admin,
			webhook.id,
			CONFIRM
		);

		expect(rotated).toMatchObject({ status: 'rotated' });
		expect(rotated).not.toMatchObject({ secret: webhook.secret });
		expect(listWebhooks(harness.runtime.db)[0].secretRotatedAt).not.toBeNull();
	});

	it('updates and deletes webhooks with audit entries', async () => {
		const webhook = await created();

		expect(
			updateWebhook(harness.runtime, harness.request(adminJar), admin, webhook.id, {
				url: 'https://hooks.example.com/other',
				events: ['post.deleted'],
				enabled: false
			})
		).toBe('updated');
		expect(listWebhooks(harness.runtime.db)[0]).toMatchObject({
			url: 'https://hooks.example.com/other',
			events: ['post.deleted'],
			enabled: false
		});
		expect(deleteWebhook(harness.runtime, harness.request(adminJar), admin, webhook.id)).toBe(
			'deleted'
		);
		expect(listWebhooks(harness.runtime.db)).toEqual([]);
		expect(
			harness.runtime.db
				.select({ action: auditLog.action })
				.from(auditLog)
				.where(eq(auditLog.targetType, 'webhook'))
				.all()
				.map((row) => row.action)
		).toEqual(['webhook.created', 'webhook.updated', 'webhook.deleted']);
	});

	it('is limited to staff', async () => {
		await expect(
			createWebhook(
				harness.runtime,
				harness.request(authorJar),
				author,
				{ url: 'https://hooks.example.com', events: ['post.published'], enabled: true },
				CONFIRM
			)
		).rejects.toMatchObject({ status: 403 });
	});
});

describe('delivery worker', () => {
	it('delivers signed events and logs the attempt', async () => {
		const webhook = await created();

		expect(enqueue()).toBe(1);

		const { dependencies, send } = worker({ statusCode: 200 });

		expect(await processDueDeliveries(harness.runtime, dependencies)).toBe(1);

		const request = send.mock.calls[0][0];
		const [delivery] = deliveries();

		expect(request.address).toBe('93.184.216.34');
		expect(request.url.href).toBe('https://hooks.example.com/build');
		expect(request.timeoutMs).toBe(10_000);
		expect(request.headers['x-servitor-event']).toBe('post.published');
		expect(request.headers['x-servitor-delivery']).toBe(delivery.id);
		expect(
			verifySignature(
				webhook.secret,
				request.body,
				request.headers['x-servitor-signature'],
				Math.floor(START.getTime() / 1000)
			)
		).toBe(true);
		expect(JSON.parse(request.body)).toEqual({
			event: 'post.published',
			delivery_id: delivery.id,
			timestamp: START.toISOString(),
			post_id: 'post-1',
			languages: ['en'],
			slugs: { en: 'hello' }
		});
		expect(delivery).toMatchObject({ status: 'succeeded', attemptCount: 1 });
		expect(listWebhookDeliveries(harness.runtime.db, webhook.id)[0]).toMatchObject({
			status: 'succeeded',
			lastStatusCode: 200,
			lastError: null
		});
	});

	it('retries with exponential backoff and gives up after five retries', async () => {
		await created();
		enqueue();

		let now = START;

		for (let attempt = 1; attempt <= 6; attempt += 1) {
			const { dependencies } = worker({ statusCode: 500 }, undefined, now);

			expect(await processDueDeliveries(harness.runtime, dependencies)).toBe(1);

			const [delivery] = deliveries();

			if (attempt < 6) {
				expect(delivery).toMatchObject({ status: 'pending', attemptCount: attempt });
				expect(delivery.nextAttemptAt?.getTime()).toBe(
					now.getTime() + retryDelayMs(attempt)
				);
				expect(
					await processDueDeliveries(
						harness.runtime,
						worker({ statusCode: 200 }, undefined, now).dependencies
					)
				).toBe(0);
				now = delivery.nextAttemptAt ?? now;
			} else {
				expect(delivery).toMatchObject({ status: 'failed', attemptCount: 6 });
			}
		}

		expect(retryDelayMs(1)).toBe(30_000);
		expect(retryDelayMs(5)).toBe(480_000);
	});

	it('never connects to blocked addresses', async () => {
		const webhook = await created();

		enqueue();

		const { dependencies, send } = worker({ statusCode: 200 }, [
			{ address: '169.254.169.254', family: 4 }
		]);

		await processDueDeliveries(harness.runtime, dependencies);

		expect(send).not.toHaveBeenCalled();
		expect(listWebhookDeliveries(harness.runtime.db, webhook.id)[0]).toMatchObject({
			status: 'pending',
			lastError: expect.stringContaining('never allowed')
		});
	});

	it('reports redirects as failures without following them', async () => {
		const webhook = await created();

		enqueue();
		await processDueDeliveries(harness.runtime, worker({ statusCode: 301 }).dependencies);

		expect(listWebhookDeliveries(harness.runtime.db, webhook.id)[0]).toMatchObject({
			lastStatusCode: 301,
			lastError: expect.stringContaining('not followed')
		});
	});

	it('fails deliveries of disabled webhooks without sending them', async () => {
		const webhook = await created();

		enqueue();
		updateWebhook(harness.runtime, harness.request(adminJar), admin, webhook.id, {
			url: 'https://hooks.example.com/build',
			events: ['post.published'],
			enabled: false
		});

		const { dependencies, send } = worker({ statusCode: 200 });

		await processDueDeliveries(harness.runtime, dependencies);

		expect(send).not.toHaveBeenCalled();
		expect(deliveries()[0]).toMatchObject({ status: 'failed' });
	});

	it('only queues events for enabled subscribers', async () => {
		const webhook = await created();

		updateWebhook(harness.runtime, harness.request(adminJar), admin, webhook.id, {
			url: 'https://hooks.example.com/build',
			events: ['post.deleted'],
			enabled: true
		});

		expect(enqueue('post.updated')).toBe(0);
	});

	it('resumes interrupted deliveries and prunes old log entries', async () => {
		await created();
		enqueue();
		harness.runtime.db.update(webhookDeliveries).set({ status: 'delivering' }).run();

		expect(recoverInterruptedDeliveries(harness.runtime)).toBe(1);
		expect(deliveries()[0].status).toBe('pending');

		await processDueDeliveries(harness.runtime, worker({ statusCode: 204 }).dependencies);

		expect(pruneDeliveryLog(harness.runtime, new Date(START.getTime() + 29 * 86_400_000))).toBe(
			0
		);
		expect(pruneDeliveryLog(harness.runtime, new Date(START.getTime() + 31 * 86_400_000))).toBe(
			1
		);
		expect(deliveries()).toEqual([]);
	});
});
