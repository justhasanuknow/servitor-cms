import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

function captureLogs(level: Parameters<typeof createLogger>[0] = 'info') {
	const lines: string[] = [];
	const logger = createLogger(level, {
		write(line: string) {
			lines.push(line);
		}
	});

	return { logger, lines };
}

function parseLines(lines: string[]): unknown[] {
	return lines.map((line): unknown => JSON.parse(line));
}

describe('createLogger', () => {
	it('writes JSON lines with a level label and an ISO timestamp', () => {
		const { logger, lines } = captureLogs();

		logger.info('server started');

		const [entry] = parseLines(lines);

		expect(entry).toMatchObject({ level: 'info', msg: 'server started' });
		expect(entry).toHaveProperty('time', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
	});

	it('redacts sensitive fields at any depth', () => {
		const { logger, lines } = captureLogs();

		logger.info(
			{
				user: 'alice',
				password: 'hunter2-hunter2',
				request: {
					headers: {
						authorization: 'Bearer abc.def',
						cookie: 'session=1',
						accept: 'text/html'
					}
				},
				settings: [{ webhookSecret: 'whsec' }, { apiKey: 'svt_abcdefghijklmnop' }]
			},
			'login attempt'
		);

		expect(parseLines(lines)[0]).toMatchObject({
			user: 'alice',
			password: '[REDACTED]',
			request: {
				headers: { authorization: '[REDACTED]', cookie: '[REDACTED]', accept: 'text/html' }
			},
			settings: [{ webhookSecret: '[REDACTED]' }, { apiKey: '[REDACTED]' }]
		});
	});

	it('redacts API keys and bearer tokens inside messages', () => {
		const { logger, lines } = captureLogs();

		logger.warn('rejected key svt_abcdefghijklmnop with Bearer abc.def');

		expect(parseLines(lines)[0]).toMatchObject({
			msg: 'rejected key svt_[REDACTED] with Bearer [REDACTED]'
		});
	});

	it('serializes errors and redacts their sensitive properties', () => {
		const { logger, lines } = captureLogs();
		const error = Object.assign(new Error('request failed with Bearer abc.def'), {
			config: { headers: { Authorization: 'Bearer abc.def' } }
		});

		logger.error({ err: error }, 'upstream error');

		expect(parseLines(lines)[0]).toMatchObject({
			err: {
				type: 'Error',
				message: 'request failed with Bearer [REDACTED]',
				config: { headers: { Authorization: '[REDACTED]' } }
			}
		});
	});

	it('redacts sensitive child logger bindings', () => {
		const { logger, lines } = captureLogs();

		logger.child({ requestId: 'req-1', sessionToken: 'abc' }).info('handled');

		expect(parseLines(lines)[0]).toMatchObject({
			requestId: 'req-1',
			sessionToken: '[REDACTED]'
		});
	});

	it('skips entries below the configured level', () => {
		const { logger, lines } = captureLogs('warn');

		logger.info('ignored');
		logger.warn('kept');

		expect(parseLines(lines)).toHaveLength(1);
	});
});
