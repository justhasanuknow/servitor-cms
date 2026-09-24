import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	applyBaselineHeaders,
	isUnsupportedMethod,
	loadRequestHandler,
	rejectUnsupportedMethod
} from './node-server';

function response(): ServerResponse {
	return new ServerResponse(new IncomingMessage(new Socket()));
}

describe('applyBaselineHeaders', () => {
	it('sets the security headers every response needs, static files included', () => {
		const target = response();

		applyBaselineHeaders(target, true);

		expect(target.getHeader('x-content-type-options')).toBe('nosniff');
		expect(target.getHeader('strict-transport-security')).toBe(
			'max-age=63072000; includeSubDomains'
		);
		expect(target.getHeader('content-security-policy')).toContain("frame-ancestors 'none'");
		expect(target.getHeader('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});
});

describe('unsupported methods', () => {
	it('refuses TRACE, TRACK and CONNECT', () => {
		for (const method of ['TRACE', 'track', 'CONNECT']) {
			expect(isUnsupportedMethod(method)).toBe(true);
		}

		for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS', undefined]) {
			expect(isUnsupportedMethod(method)).toBe(false);
		}
	});

	it('answers them with 405 and the allowed methods', () => {
		const target = response();

		applyBaselineHeaders(target, true);
		rejectUnsupportedMethod(target);

		expect(target.statusCode).toBe(405);
		expect(target.getHeader('allow')).toBe('GET, HEAD, POST, OPTIONS');
		expect(target.getHeader('x-content-type-options')).toBe('nosniff');
	});
});

describe('loadRequestHandler', () => {
	let directory: string;

	beforeEach(() => {
		directory = resolve('.tmp', 'tests', `handler-${crypto.randomUUID()}`);
		mkdirSync(directory, { recursive: true });
	});

	afterEach(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	it('loads the handler exported by the built app', async () => {
		const file = join(directory, 'handler.mjs');

		writeFileSync(
			file,
			'export function handler(request, response) { response.handled = true; }\n'
		);

		const handler = await loadRequestHandler(pathToFileURL(file));
		const target = response();

		handler(new IncomingMessage(new Socket()), target);

		expect(target).toHaveProperty('handled', true);
	});

	it('refuses a module without a handler', async () => {
		const file = join(directory, 'other.mjs');

		writeFileSync(file, 'export const handler = 42;\n');

		await expect(loadRequestHandler(pathToFileURL(file))).rejects.toThrow(
			'does not export a request handler'
		);
	});
});
