export interface WebhookRequest {
	url: URL;
	address: string;
	family: 4 | 6;
	headers: Record<string, string>;
	body: string;
	timeoutMs: number;
}

export type WebhookResponse = { statusCode: number } | { error: string };

export type WebhookSender = (request: WebhookRequest) => Promise<WebhookResponse>;
