import { describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env';
import { isLoopbackHost, smtpTransportOptions } from './mailer';

function smtpEnv(host: string, secure: string) {
	return parseEnv({
		ORIGIN: 'https://cms.example.com',
		BETTER_AUTH_SECRET: 'a-secret-that-is-long-enough-for-the-tests',
		SMTP_HOST: host,
		SMTP_PORT: '587',
		SMTP_USER: 'mailer',
		SMTP_PASSWORD: 'secret',
		SMTP_FROM: 'Servitor <cms@example.com>',
		SMTP_SECURE: secure
	});
}

describe('smtpTransportOptions', () => {
	it('never falls back to a plain connection with a remote server', () => {
		const options = smtpTransportOptions(smtpEnv('smtp.example.com', 'false'));

		expect(options.requireTLS).toBe(true);
		expect(options.tls).toEqual({ minVersion: 'TLSv1.2', rejectUnauthorized: true });
	});

	it('uses TLS from the start when SMTP_SECURE is on', () => {
		expect(smtpTransportOptions(smtpEnv('smtp.example.com', 'true')).secure).toBe(true);
	});

	it('allows a plain connection only to a relay on the same machine', () => {
		expect(smtpTransportOptions(smtpEnv('localhost', 'false')).requireTLS).toBe(false);
		expect(smtpTransportOptions(smtpEnv('127.0.0.1', 'false')).requireTLS).toBe(false);
	});
});

describe('isLoopbackHost', () => {
	it('recognizes loopback names and addresses', () => {
		for (const host of [
			'localhost',
			'LOCALHOST',
			'mail.localhost',
			'127.0.0.1',
			'127.8.9.10',
			'::1',
			'[::1]'
		]) {
			expect(isLoopbackHost(host)).toBe(true);
		}
	});

	it('treats every other host as remote', () => {
		for (const host of [
			'smtp.example.com',
			'localhost.example.com',
			'10.0.0.5',
			'128.0.0.1',
			'::2'
		]) {
			expect(isLoopbackHost(host)).toBe(false);
		}
	});
});
