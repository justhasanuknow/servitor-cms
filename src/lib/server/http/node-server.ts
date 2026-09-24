import type { ServerResponse } from 'node:http';
import type { HeaderTarget, NodeRequestHandler } from './node-server.interfaces';
import { baselineHeaders } from './security-headers';

const UNSUPPORTED_METHODS = new Set(['TRACE', 'TRACK', 'CONNECT']);

const ALLOWED_METHODS = 'GET, HEAD, POST, OPTIONS';

export function applyBaselineHeaders(response: HeaderTarget, production: boolean): void {
	for (const [name, value] of baselineHeaders(production)) {
		response.setHeader(name, value);
	}
}

export function isUnsupportedMethod(method: string | undefined): boolean {
	return method !== undefined && UNSUPPORTED_METHODS.has(method.toUpperCase());
}

export function rejectUnsupportedMethod(response: ServerResponse): void {
	response.writeHead(405, { Allow: ALLOWED_METHODS, 'Content-Length': '0' });
	response.end();
}

export async function loadRequestHandler(location: URL): Promise<NodeRequestHandler> {
	const loaded: unknown = await import(location.href);

	if (
		typeof loaded !== 'object' ||
		loaded === null ||
		!('handler' in loaded) ||
		typeof loaded.handler !== 'function'
	) {
		throw new Error(`${location.href} does not export a request handler`);
	}

	const handler = loaded.handler;

	return (request, response) => {
		handler(request, response);
	};
}
