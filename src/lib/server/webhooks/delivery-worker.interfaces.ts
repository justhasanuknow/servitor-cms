import type { WebhookEvent } from '../../constants/webhooks';
import type { Resolver } from './safe-target.interfaces';
import type { WebhookSender } from './transport.interfaces';

export interface WebhookWorkerDependencies {
	resolve: Resolver;
	send: WebhookSender;
	now: () => Date;
}

export interface DueDelivery {
	id: string;
	webhookId: string;
	event: WebhookEvent;
	payload: string;
	attemptCount: number;
	url: string;
	enabled: boolean;
	secretCiphertext: string;
}

export interface AttemptOutcome {
	statusCode: number | null;
	error: string | null;
	final: boolean;
}
