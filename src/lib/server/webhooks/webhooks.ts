import { and, count, desc, eq, inArray } from 'drizzle-orm';
import {
	MAX_WEBHOOKS,
	WEBHOOK_DELIVERIES_SHOWN,
	WEBHOOK_URL_MAX_LENGTH
} from '../../constants/webhooks';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { reauthenticate } from '../auth/reauthentication';
import type { ReauthenticationInput } from '../auth/reauthentication.interfaces';
import type { DatabaseExecutor } from '../db';
import { user, webhookDeliveries, webhookDeliveryAttempts, webhooks } from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import { secretKeys } from '../security/secret-keys';
import { encryptSecret } from './secret-box';
import { generateWebhookSecret } from './signing';
import type {
	WebhookCreateResult,
	WebhookDeliveryView,
	WebhookInput,
	WebhookRotateResult,
	WebhookUpdateResult,
	WebhookView
} from './webhooks.interfaces';

export function normalizeWebhookUrl(value: string, allowPrivate: boolean): string | null {
	const trimmed = value.trim();

	if (trimmed === '' || trimmed.length > WEBHOOK_URL_MAX_LENGTH) {
		return null;
	}

	let url: URL;

	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	const httpAllowed = allowPrivate && url.protocol === 'http:';

	if (url.protocol !== 'https:' && !httpAllowed) {
		return null;
	}

	if (url.username !== '' || url.password !== '' || url.hash !== '' || url.hostname === '') {
		return null;
	}

	return url.href;
}

function validate(
	runtime: Runtime,
	input: WebhookInput
): WebhookInput | 'invalid_url' | 'no_events' {
	const url = normalizeWebhookUrl(input.url, runtime.env.WEBHOOK_ALLOW_PRIVATE);

	if (url === null) {
		return 'invalid_url';
	}

	if (input.events.length === 0) {
		return 'no_events';
	}

	return { url, events: [...new Set(input.events)], enabled: input.enabled };
}

export async function createWebhook(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: WebhookInput,
	confirmation: ReauthenticationInput
): Promise<WebhookCreateResult> {
	requirePermission(actor, 'webhook.manage', null);

	const valid = validate(runtime, input);

	if (typeof valid === 'string') {
		return { status: valid };
	}

	const verified = await reauthenticate(runtime, request, actor, confirmation);

	if (verified !== 'verified') {
		return { status: verified };
	}

	const existing = runtime.db.select({ total: count() }).from(webhooks).get()?.total ?? 0;

	if (existing >= MAX_WEBHOOKS) {
		return { status: 'too_many' };
	}

	const id = crypto.randomUUID();
	const secret = generateWebhookSecret();

	runtime.db.transaction((tx) => {
		tx.insert(webhooks)
			.values({
				id,
				url: valid.url,
				events: valid.events,
				enabled: valid.enabled,
				secretCiphertext: encryptSecret(secret, secretKeys(runtime.env)),
				createdBy: actor.id
			})
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'webhook.created',
			targetType: 'webhook',
			targetId: id,
			details: { url: valid.url, events: valid.events, enabled: valid.enabled },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return { status: 'created', id, secret };
}

export function updateWebhook(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string,
	input: WebhookInput
): WebhookUpdateResult {
	requirePermission(actor, 'webhook.manage', null);

	const valid = validate(runtime, input);

	if (typeof valid === 'string') {
		return valid;
	}

	return runtime.db.transaction((tx): WebhookUpdateResult => {
		const current = tx.select().from(webhooks).where(eq(webhooks.id, id)).get();

		if (current === undefined) {
			return 'not_found';
		}

		tx.update(webhooks)
			.set({ url: valid.url, events: valid.events, enabled: valid.enabled })
			.where(eq(webhooks.id, id))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'webhook.updated',
			targetType: 'webhook',
			targetId: id,
			details: {
				url: valid.url,
				events: valid.events,
				enabled: valid.enabled,
				previousUrl: current.url
			},
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'updated';
	});
}

export function deleteWebhook(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string
): 'deleted' | 'not_found' {
	requirePermission(actor, 'webhook.manage', null);

	return runtime.db.transaction((tx) => {
		const current = tx
			.select({ url: webhooks.url })
			.from(webhooks)
			.where(eq(webhooks.id, id))
			.get();

		if (current === undefined) {
			return 'not_found';
		}

		tx.delete(webhooks).where(eq(webhooks.id, id)).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'webhook.deleted',
			targetType: 'webhook',
			targetId: id,
			details: { url: current.url },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'deleted';
	});
}

export async function rotateWebhookSecret(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string,
	confirmation: ReauthenticationInput,
	now: Date = new Date()
): Promise<WebhookRotateResult> {
	requirePermission(actor, 'webhook.manage', null);

	if (
		runtime.db.select({ id: webhooks.id }).from(webhooks).where(eq(webhooks.id, id)).get() ===
		undefined
	) {
		return { status: 'not_found' };
	}

	const verified = await reauthenticate(runtime, request, actor, confirmation);

	if (verified !== 'verified') {
		return { status: verified };
	}

	const secret = generateWebhookSecret();

	runtime.db.transaction((tx) => {
		tx.update(webhooks)
			.set({
				secretCiphertext: encryptSecret(secret, secretKeys(runtime.env)),
				secretRotatedAt: now
			})
			.where(eq(webhooks.id, id))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'webhook.secret_rotated',
			targetType: 'webhook',
			targetId: id,
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return { status: 'rotated', secret };
}

export function listWebhooks(db: DatabaseExecutor): WebhookView[] {
	const rows = db
		.select({
			id: webhooks.id,
			url: webhooks.url,
			events: webhooks.events,
			enabled: webhooks.enabled,
			createdAt: webhooks.createdAt,
			secretRotatedAt: webhooks.secretRotatedAt,
			createdByName: user.name
		})
		.from(webhooks)
		.innerJoin(user, eq(user.id, webhooks.createdBy))
		.orderBy(desc(webhooks.createdAt))
		.all();
	const counts = new Map<string, { pending: number; failed: number }>();

	for (const row of db
		.select({
			webhookId: webhookDeliveries.webhookId,
			status: webhookDeliveries.status,
			total: count()
		})
		.from(webhookDeliveries)
		.where(inArray(webhookDeliveries.status, ['pending', 'delivering', 'failed']))
		.groupBy(webhookDeliveries.webhookId, webhookDeliveries.status)
		.all()) {
		const entry = counts.get(row.webhookId) ?? { pending: 0, failed: 0 };

		if (row.status === 'failed') {
			entry.failed += row.total;
		} else {
			entry.pending += row.total;
		}

		counts.set(row.webhookId, entry);
	}

	return rows.map((row) => ({
		...row,
		pendingCount: counts.get(row.id)?.pending ?? 0,
		failedCount: counts.get(row.id)?.failed ?? 0
	}));
}

export function findWebhook(db: DatabaseExecutor, id: string): WebhookView | null {
	return listWebhooks(db).find((webhook) => webhook.id === id) ?? null;
}

export function listWebhookDeliveries(
	db: DatabaseExecutor,
	webhookId: string,
	limit: number = WEBHOOK_DELIVERIES_SHOWN
): WebhookDeliveryView[] {
	const deliveries = db
		.select()
		.from(webhookDeliveries)
		.where(eq(webhookDeliveries.webhookId, webhookId))
		.orderBy(desc(webhookDeliveries.createdAt))
		.limit(limit)
		.all();
	const latest = new Map<string, typeof webhookDeliveryAttempts.$inferSelect>();

	if (deliveries.length > 0) {
		for (const attempt of db
			.select()
			.from(webhookDeliveryAttempts)
			.where(
				and(
					inArray(
						webhookDeliveryAttempts.deliveryId,
						deliveries.map((delivery) => delivery.id)
					)
				)
			)
			.orderBy(desc(webhookDeliveryAttempts.createdAt))
			.all()) {
			if (!latest.has(attempt.deliveryId)) {
				latest.set(attempt.deliveryId, attempt);
			}
		}
	}

	return deliveries.map((delivery) => {
		const attempt = latest.get(delivery.id);

		return {
			id: delivery.id,
			event: delivery.event,
			status: delivery.status,
			attemptCount: delivery.attemptCount,
			createdAt: delivery.createdAt,
			completedAt: delivery.completedAt,
			nextAttemptAt: delivery.nextAttemptAt,
			lastStatusCode: attempt?.statusCode ?? null,
			lastDurationMs: attempt?.durationMs ?? null,
			lastError: attempt?.error ?? null
		};
	});
}
