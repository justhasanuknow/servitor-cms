import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logging/logger';
import { parseEnv } from '../config/env';
import { createMailer, disabledMailer, sendInBackground, smtpConfigured } from './mailer';
import {
	emailChangedNotice,
	emailChangeVerification,
	inviteEmail,
	newDeviceEmail,
	passwordResetEmail
} from './templates';

const BASE_ENV = {
	ORIGIN: 'https://cms.example.com',
	BETTER_AUTH_SECRET: 'a-secret-that-is-long-enough-for-the-tests'
};

const SMTP_ENV = {
	...BASE_ENV,
	SMTP_HOST: 'smtp.example.com',
	SMTP_PORT: '465',
	SMTP_USER: 'mailer',
	SMTP_PASSWORD: 'secret',
	SMTP_FROM: 'Servitor <cms@example.com>',
	SMTP_SECURE: 'true'
};

describe('email templates', () => {
	it('builds plain text and HTML with the link', () => {
		const email = inviteEmail(
			'en',
			'Field Notes',
			'Ada',
			'https://cms.example.com/panel/invite/abc'
		);

		expect(email.subject).toBe('You are invited to Field Notes');
		expect(email.text).toContain('Ada invited you to Field Notes.');
		expect(email.text).toContain('https://cms.example.com/panel/invite/abc');
		expect(email.html).toContain('<a href="https://cms.example.com/panel/invite/abc">');
		expect(email.html).toContain('<html lang="en">');
	});

	it('escapes names and addresses in the HTML part', () => {
		const email = inviteEmail(
			'en',
			'Site',
			'<script>alert(1)</script>',
			'https://x.test/?a=1&b="2"'
		);

		expect(email.html).not.toContain('<script>');
		expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(email.html).toContain('href="https://x.test/?a=1&amp;b=&quot;2&quot;"');
	});

	it('uses the language of the recipient', () => {
		expect(passwordResetEmail('tr', 'Site', 'https://x.test').subject).toBe(
			'Site parolanızı sıfırlayın'
		);
		expect(passwordResetEmail('de', 'Site', 'https://x.test').text).toContain('30 Minuten');
		expect(
			emailChangeVerification('ja', 'Site', 'new@example.com', 'https://x.test').html
		).toContain('<html lang="ja">');
	});

	it('covers the notices without links', () => {
		expect(emailChangedNotice('en', 'Site', 'new@example.com').text).toContain(
			'new@example.com'
		);
		expect(emailChangedNotice('en', 'Site', 'new@example.com').html).not.toContain('<a ');

		const device = newDeviceEmail('fr', 'Site', {
			device: 'Firefox · Linux',
			ip: '203.0.113.9',
			time: '24 septembre 2026 à 12:00 UTC'
		});

		expect(device.text).toContain('Firefox · Linux');
		expect(device.text).toContain('203.0.113.9');
	});
});

describe('mailer', () => {
	it('stays off unless every SMTP setting is present', () => {
		expect(smtpConfigured(parseEnv(BASE_ENV))).toBe(false);
		expect(createMailer(parseEnv(BASE_ENV))).toBe(disabledMailer);
		expect(smtpConfigured(parseEnv({ ...SMTP_ENV, SMTP_PASSWORD: undefined }))).toBe(false);
		expect(smtpConfigured(parseEnv(SMTP_ENV))).toBe(true);
		expect(createMailer(parseEnv(SMTP_ENV)).enabled).toBe(true);
	});

	it('logs background failures instead of throwing', async () => {
		const logger = createLogger('silent');
		const error = vi.spyOn(logger, 'error');

		sendInBackground(disabledMailer, logger, {
			to: 'a@example.com',
			subject: 's',
			text: 't',
			html: 'h'
		});
		await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));
	});
});
