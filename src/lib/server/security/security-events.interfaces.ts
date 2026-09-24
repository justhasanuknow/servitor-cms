export type SecurityEvent =
	| { type: 'permission_denied'; actorId: string | null; action: string }
	| { type: 'rate_limited'; limit: string; userId?: string }
	| { type: 'reauthentication_failed'; userId: string; reason: string }
	| { type: 'totp_reused'; userId: string }
	| { type: 'api_request_rejected'; status: number; code: string }
	| { type: 'cors_origin_rejected'; origin: string }
	| { type: 'webhook_target_blocked'; webhookId: string; reason: string };

export type SecurityEventListener = (event: SecurityEvent) => void;

export interface SecurityEventContext {
	requestId: string | null;
	method: string;
	route: string | null;
	ip: string | null;
}
