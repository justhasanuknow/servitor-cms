import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { WEBHOOK_ERROR_MAX_LENGTH } from '../../constants/webhooks';
import type { WebhookRequest, WebhookResponse } from './transport.interfaces';

const TIMEOUT_ERRORS = new Set(['AbortError', 'TimeoutError']);

function pinnedLookup(address: string, family: 4 | 6): LookupFunction {
	return (_hostname, options, callback) => {
		if (options.all === true) {
			callback(null, [{ address, family }]);

			return;
		}

		callback(null, address, family);
	};
}

function openRequest(
	url: URL,
	options: https.RequestOptions,
	onResponse: (response: http.IncomingMessage) => void
): http.ClientRequest {
	if (url.protocol === 'https:') {
		return https.request(url, options, onResponse);
	}

	return http.request(url, options, onResponse);
}

export function errorText(error: unknown): string {
	let text = 'The request failed.';

	if (error instanceof Error && TIMEOUT_ERRORS.has(error.name)) {
		text = 'The request timed out.';
	} else if (error instanceof Error && error.message !== '') {
		text = error.message;
	}

	return text.slice(0, WEBHOOK_ERROR_MAX_LENGTH);
}

export function sendWebhookRequest(request: WebhookRequest): Promise<WebhookResponse> {
	return new Promise((resolve) => {
		let settled = false;

		function finish(response: WebhookResponse): void {
			if (!settled) {
				settled = true;
				resolve(response);
			}
		}

		const outgoing = openRequest(
			request.url,
			{
				method: 'POST',
				agent: false,
				lookup: pinnedLookup(request.address, request.family),
				signal: AbortSignal.timeout(request.timeoutMs),
				headers: {
					...request.headers,
					'content-length': String(Buffer.byteLength(request.body))
				}
			},
			(response) => {
				finish({ statusCode: response.statusCode ?? 0 });
				response.resume();
				response.destroy();
			}
		);

		outgoing.on('error', (error) => {
			finish({ error: errorText(error) });
		});
		outgoing.end(request.body);
	});
}
