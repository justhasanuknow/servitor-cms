import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sendWebhookRequest } from './transport';

let server: Server;

let port: number;

let received: { url: string; headers: IncomingMessage['headers']; body: string }[];

let respond: (url: string) => { status: number; delayMs?: number; location?: string };

beforeEach(async () => {
	received = [];
	respond = () => ({ status: 204 });
	server = createServer((request, response) => {
		let body = '';

		request.on('data', (chunk: Buffer) => {
			body += chunk.toString('utf8');
		});
		request.on('end', () => {
			const url = request.url ?? '';
			const plan = respond(url);

			received.push({ url, headers: request.headers, body });
			setTimeout(() => {
				if (plan.location !== undefined) {
					response.setHeader('location', plan.location);
				}

				response.statusCode = plan.status;
				response.end();
			}, plan.delayMs ?? 0);
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

function send(path: string, timeoutMs = 2_000) {
	return sendWebhookRequest({
		url: new URL(`http://webhook.invalid:${port}${path}`),
		address: '127.0.0.1',
		family: 4,
		headers: { 'content-type': 'application/json', 'x-servitor-event': 'post.published' },
		body: '{"ok":true}',
		timeoutMs
	});
}

describe('webhook transport', () => {
	it('connects to the pinned address instead of resolving the host again', async () => {
		expect(await send('/hook')).toEqual({ statusCode: 204 });
		expect(received).toHaveLength(1);
		expect(received[0].headers.host).toBe(`webhook.invalid:${port}`);
		expect(received[0].headers['x-servitor-event']).toBe('post.published');
		expect(received[0].body).toBe('{"ok":true}');
	});

	it('does not follow redirects', async () => {
		respond = (url) => {
			if (url === '/hook') {
				return { status: 302, location: `http://127.0.0.1:${port}/elsewhere` };
			}

			return { status: 200 };
		};

		expect(await send('/hook')).toEqual({ statusCode: 302 });
		expect(received.map((entry) => entry.url)).toEqual(['/hook']);
	});

	it('gives up after the timeout', async () => {
		respond = () => ({ status: 200, delayMs: 1_000 });

		expect(await send('/slow', 100)).toEqual({ error: 'The request timed out.' });
	});

	it('reports connection errors', async () => {
		const result = await sendWebhookRequest({
			url: new URL('http://webhook.invalid:1/hook'),
			address: '127.0.0.1',
			family: 4,
			headers: {},
			body: '{}',
			timeoutMs: 2_000
		});

		expect(result).toMatchObject({ error: expect.stringContaining('ECONNREFUSED') });
	});
});
