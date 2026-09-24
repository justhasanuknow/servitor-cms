import { describe, expect, it } from 'vitest';
import { isSensitiveKey, redactLogLine, redactString } from './redact';

function redactEntry(entry: unknown): unknown {
	return JSON.parse(redactLogLine(`${JSON.stringify(entry)}\n`));
}

describe('isSensitiveKey', () => {
	it.each([
		'password',
		'newPassword',
		'FOUNDER_PASSWORD',
		'SMTP_PASSWORD',
		'BETTER_AUTH_SECRET',
		'webhookSecret',
		'totpSecret',
		'backupCodes',
		'authorization',
		'Proxy-Authorization',
		'cookie',
		'set-cookie',
		'apiKey',
		'x-api-key',
		'accessToken',
		'refresh_token'
	])('treats %s as sensitive', (key) => {
		expect(isSensitiveKey(key)).toBe(true);
	});

	it.each(['email', 'userId', 'status', 'path', 'method', 'durationMs'])(
		'treats %s as safe',
		(key) => {
			expect(isSensitiveKey(key)).toBe(false);
		}
	);
});

describe('redactString', () => {
	it('masks API keys, bearer tokens and basic credentials', () => {
		expect(redactString('key=svt_AbC123_-xyz')).toBe('key=svt_[REDACTED]');
		expect(redactString('Authorization: Bearer eyJhbGciOi.J9.x')).toBe(
			'Authorization: Bearer [REDACTED]'
		);
		expect(redactString('basic dXNlcjpwYXNz')).toBe('basic [REDACTED]');
	});

	it('leaves ordinary text unchanged', () => {
		expect(redactString('Published post 42')).toBe('Published post 42');
	});
});

describe('redactLogLine', () => {
	it('redacts sensitive keys inside nested objects and arrays', () => {
		const entry = {
			user: 'alice',
			request: { headers: [{ authorization: 'Bearer abc' }, { accept: 'text/html' }] }
		};

		expect(redactEntry(entry)).toEqual({
			user: 'alice',
			request: { headers: [{ authorization: '[REDACTED]' }, { accept: 'text/html' }] }
		});
	});

	it('keeps the line terminator', () => {
		expect(redactLogLine('{"msg":"ok"}\n')).toBe('{"msg":"ok"}\n');
	});

	it('truncates deeply nested structures', () => {
		let deep: Record<string, unknown> = { value: 'bottom' };

		for (let level = 0; level < 20; level += 1) {
			deep = { child: deep };
		}

		expect(JSON.stringify(redactEntry(deep))).toContain('[Truncated]');
	});

	it('masks secrets in a line that is not JSON', () => {
		expect(redactLogLine('fallback svt_abcdefghijklmnop')).toBe('fallback svt_[REDACTED]');
	});
});
