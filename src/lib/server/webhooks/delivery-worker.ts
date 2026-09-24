import { and, asc, eq, inArray, isNotNull, lt, lte } from 'drizzle-orm';
import {
	WEBHOOK_BATCH_SIZE,
	WEBHOOK_LOG_RETENTION_MS,
	WEBHOOK_MAX_RETRIES,
	WEBHOOK_RETRY_BASE_MS,
	WEBHOOK_TIMEOUT_MS,
	WEBHOOK_WORKER_INTERVAL_MS
} from '../../constants/webhooks';
import { webhookDeliveries, webhookDeliveryAttempts, webhooks } from '../db/schema';
import type { Runtime } from '../runtime.interfaces';
import type {
	AttemptOutcome,
	DueDelivery,
	WebhookWorkerDependencies
} from './delivery-worker.interfaces';
import { resolveWebhookTarget, systemResolver } from './safe-target';
import type { TargetRejection } from './safe-target.interfaces';
import { decryptSecret } from './secret-box';
import { signatureHeader } from './signing';
import { sendWebhookRequest } from './transport';

const USER_AGENT = 'Servitor-Webhooks/1.0';

const MILLISECONDS_PER_SECOND = 1000;

const REJECTION_MESSAGES: Record<TargetRejection, string> = {
	unsupported_scheme: 'Only https addresses can receive webhooks.',
	credentials_in_url: 'The address must not contain a user name or password.',
	dns_failed: 'The host name could not be resolved.',
	blocked_address:
		'The host resolves to a loopback, link-local, multicast or reserved address, which is never allowed.',
	private_address:
		'The host resolves to a private address. Set WEBHOOK_ALLOW_PRIVATE=true to allow it.',
	insecure_scheme:
		'Plain http is only allowed for private addresses with WEBHOOK_ALLOW_PRIVATE=true.'
};

let stopActive: (() => void) | null = null;

export function retryDelayMs(attempt: number): number {
	return WEBHOOK_RETRY_BASE_MS * 2 ** (attempt - 1);
}

export function recoverInterruptedDeliveries(runtime: Runtime): number {
	return runtime.db
		.update(webhookDeliveries)
		.set({ status: 'pending' })
		.where(eq(webhookDeliveries.status, 'delivering'))
		.run().changes;
}

export function pruneDeliveryLog(runtime: Runtime, now: Date): number {
	return runtime.db
		.delete(webhookDeliveries)
		.where(
			and(
				inArray(webhookDeliveries.status, ['succeeded', 'failed']),
				isNotNull(webhookDeliveries.completedAt),
				lt(
					webhookDeliveries.completedAt,
					new Date(now.getTime() - WEBHOOK_LOG_RETENTION_MS)
				)
			)
		)
		.run().changes;
}

async function attempt(
	runtime: Runtime,
	dependencies: WebhookWorkerDependencies,
	delivery: DueDelivery,
	now: Date
): Promise<AttemptOutcome> {
	if (!delivery.enabled) {
		return { statusCode: null, error: 'The webhook is disabled.', final: true };
	}

	const secret = decryptSecret(delivery.secretCiphertext, runtime.env.BETTER_AUTH_SECRET);

	if (secret === null) {
		return {
			statusCode: null,
			error: 'The webhook secret cannot be decrypted. Rotate the secret.',
			final: true
		};
	}

	const url = new URL(delivery.url);
	const target = await resolveWebhookTarget(url, {
		allowPrivate: runtime.env.WEBHOOK_ALLOW_PRIVATE,
		resolve: dependencies.resolve
	});

	if (target.status === 'rejected') {
		return { statusCode: null, error: REJECTION_MESSAGES[target.reason], final: false };
	}

	const response = await dependencies.send({
		url,
		address: target.address,
		family: target.family,
		body: delivery.payload,
		timeoutMs: WEBHOOK_TIMEOUT_MS,
		headers: {
			'content-type': 'application/json',
			'user-agent': USER_AGENT,
			'x-servitor-event': delivery.event,
			'x-servitor-delivery': delivery.id,
			'x-servitor-signature': signatureHeader(
				secret,
				delivery.payload,
				Math.floor(now.getTime() / MILLISECONDS_PER_SECOND)
			)
		}
	});

	if ('error' in response) {
		return { statusCode: null, error: response.error, final: false };
	}

	if (response.statusCode >= 200 && response.statusCode < 300) {
		return { statusCode: response.statusCode, error: null, final: false };
	}

	let error = `The endpoint answered with status ${response.statusCode}.`;

	if (response.statusCode >= 300 && response.statusCode < 400) {
		error = `The endpoint answered with a redirect (${response.statusCode}), which is not followed.`;
	}

	return { statusCode: response.statusCode, error, final: false };
}

function finalize(
	runtime: Runtime,
	delivery: DueDelivery,
	outcome: AttemptOutcome,
	durationMs: number,
	now: Date
): void {
	const attempts = delivery.attemptCount + 1;

	runtime.db.transaction((tx) => {
		tx.insert(webhookDeliveryAttempts)
			.values({
				deliveryId: delivery.id,
				statusCode: outcome.statusCode,
				durationMs,
				error: outcome.error,
				createdAt: now
			})
			.run();

		if (outcome.error === null) {
			tx.update(webhookDeliveries)
				.set({
					status: 'succeeded',
					attemptCount: attempts,
					completedAt: now,
					nextAttemptAt: null
				})
				.where(eq(webhookDeliveries.id, delivery.id))
				.run();

			return;
		}

		if (outcome.final || attempts > WEBHOOK_MAX_RETRIES) {
			tx.update(webhookDeliveries)
				.set({
					status: 'failed',
					attemptCount: attempts,
					completedAt: now,
					nextAttemptAt: null
				})
				.where(eq(webhookDeliveries.id, delivery.id))
				.run();

			return;
		}

		tx.update(webhookDeliveries)
			.set({
				status: 'pending',
				attemptCount: attempts,
				nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts))
			})
			.where(eq(webhookDeliveries.id, delivery.id))
			.run();
	});
}

export async function processDueDeliveries(
	runtime: Runtime,
	dependencies: WebhookWorkerDependencies
): Promise<number> {
	const now = dependencies.now();
	const due = runtime.db
		.select({
			id: webhookDeliveries.id,
			event: webhookDeliveries.event,
			payload: webhookDeliveries.payload,
			attemptCount: webhookDeliveries.attemptCount,
			url: webhooks.url,
			enabled: webhooks.enabled,
			secretCiphertext: webhooks.secretCiphertext
		})
		.from(webhookDeliveries)
		.innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
		.where(
			and(eq(webhookDeliveries.status, 'pending'), lte(webhookDeliveries.nextAttemptAt, now))
		)
		.orderBy(asc(webhookDeliveries.nextAttemptAt))
		.limit(WEBHOOK_BATCH_SIZE)
		.all();
	let processed = 0;

	for (const delivery of due) {
		const claimed = runtime.db
			.update(webhookDeliveries)
			.set({ status: 'delivering' })
			.where(
				and(eq(webhookDeliveries.id, delivery.id), eq(webhookDeliveries.status, 'pending'))
			)
			.run().changes;

		if (claimed === 0) {
			continue;
		}

		const started = performance.now();
		const outcome = await attempt(runtime, dependencies, delivery, now);

		finalize(runtime, delivery, outcome, Math.round(performance.now() - started), now);
		processed += 1;
	}

	return processed;
}

export function startWebhookWorker(
	runtime: Runtime,
	dependencies: WebhookWorkerDependencies = {
		resolve: systemResolver,
		send: sendWebhookRequest,
		now: () => new Date()
	}
): () => void {
	stopActive?.();
	recoverInterruptedDeliveries(runtime);

	let running = false;

	const run = async () => {
		if (running) {
			return;
		}

		running = true;

		try {
			pruneDeliveryLog(runtime, dependencies.now());
			await processDueDeliveries(runtime, dependencies);
		} catch (error) {
			runtime.logger.error({ err: error }, 'The webhook worker could not deliver events');
		} finally {
			running = false;
		}
	};
	const timer = setInterval(() => {
		void run();
	}, WEBHOOK_WORKER_INTERVAL_MS);

	timer.unref();
	void run();
	stopActive = () => {
		clearInterval(timer);
		stopActive = null;
	};

	return stopActive;
}
