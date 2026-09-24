import { describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import { reportServerError } from './server-error';
import type { ServerErrorContext } from './server-error.interfaces';

function captureLogs() {
	const lines: string[] = [];
	const logger = createLogger('info', {
		write(line: string) {
			lines.push(line);
		}
	});

	return { logger, lines };
}

function contextWith(overrides: Partial<ServerErrorContext> = {}): ServerErrorContext {
	return {
		error: new Error('database exploded'),
		status: 500,
		message: 'Internal Error',
		requestId: 'request-1',
		method: 'POST',
		routeId: '/panel/invite/[token]',
		...overrides
	};
}

describe('reportServerError', () => {
	it('logs server errors with the request id as correlation id', () => {
		const { logger, lines } = captureLogs();

		const result = reportServerError(contextWith(), logger);
		const entry: unknown = JSON.parse(lines[0]);

		expect(result).toEqual({ message: 'Internal Error', correlationId: 'request-1' });
		expect(entry).toMatchObject({
			level: 'error',
			correlationId: 'request-1',
			status: 500,
			method: 'POST',
			route: '/panel/invite/[token]',
			err: { message: 'database exploded' }
		});
	});

	it('creates a correlation id when the request has none', () => {
		const { logger } = captureLogs();

		const result = reportServerError(contextWith({ requestId: undefined }), logger);

		expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('does not log or expose a correlation id for client errors', () => {
		const { logger, lines } = captureLogs();

		const result = reportServerError(
			contextWith({ status: 404, message: 'Not Found' }),
			logger
		);

		expect(result).toEqual({ message: 'Not Found' });
		expect(lines).toHaveLength(0);
	});
});
