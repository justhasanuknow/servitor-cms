import type { WebhookDeliveryStatus, WebhookEvent } from '../../constants/webhooks';
import type { ReauthenticationResult } from '../auth/reauthentication.interfaces';

export interface WebhookInput {
	url: string;
	events: WebhookEvent[];
	enabled: boolean;
}

export type WebhookInputError = 'invalid_url' | 'no_events' | 'too_many';

export type WebhookCreateResult =
	| { status: 'created'; id: string; secret: string }
	| { status: Exclude<ReauthenticationResult, 'verified'> }
	| { status: WebhookInputError };

export type WebhookUpdateResult = 'updated' | 'not_found' | Exclude<WebhookInputError, 'too_many'>;

export type WebhookRotateResult =
	| { status: 'rotated'; secret: string }
	| { status: 'not_found' }
	| { status: Exclude<ReauthenticationResult, 'verified'> };

export interface WebhookView {
	id: string;
	url: string;
	events: WebhookEvent[];
	enabled: boolean;
	createdAt: Date;
	createdByName: string;
	secretRotatedAt: Date | null;
	pendingCount: number;
	failedCount: number;
}

export interface WebhookDeliveryView {
	id: string;
	event: WebhookEvent;
	status: WebhookDeliveryStatus;
	attemptCount: number;
	createdAt: Date;
	completedAt: Date | null;
	nextAttemptAt: Date | null;
	lastStatusCode: number | null;
	lastDurationMs: number | null;
	lastError: string | null;
}
