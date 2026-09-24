import { describe, expect, it } from 'vitest';
import { EnvValidationError, missingSmtpKeys, parseEnv } from './env';

const SECRET = 'x'.repeat(40);

const SMTP_ENV = {
	SMTP_HOST: 'smtp.example.com',
	SMTP_PORT: '587',
	SMTP_USER: 'mailer',
	SMTP_PASSWORD: 'smtp-password',
	SMTP_FROM: 'Servitor <cms@example.com>',
	SMTP_SECURE: 'false'
};

function envWith(
	overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
	return { ORIGIN: 'https://cms.example.com', BETTER_AUTH_SECRET: SECRET, ...overrides };
}

function validationMessage(source: Record<string, string | undefined>): string {
	try {
		parseEnv(source);
	} catch (error) {
		if (error instanceof EnvValidationError) {
			return error.message;
		}

		throw error;
	}

	throw new Error('Expected the environment to be rejected');
}

describe('parseEnv', () => {
	it('applies the documented defaults', () => {
		const env = parseEnv(envWith());

		expect(env).toMatchObject({
			ORIGIN: 'https://cms.example.com',
			DATABASE_PATH: '/data/servitor.db',
			UPLOADS_DIR: '/data/uploads',
			DEFAULT_CONTENT_LANGUAGE: 'en',
			WEBHOOK_ALLOW_PRIVATE: false,
			LOG_LEVEL: 'info'
		});
		expect(env.SMTP_HOST).toBeUndefined();
	});

	it('requires ORIGIN and BETTER_AUTH_SECRET', () => {
		const message = validationMessage({});

		expect(message).toContain('ORIGIN: is required');
		expect(message).toContain('BETTER_AUTH_SECRET: is required');
	});

	it('rejects a short BETTER_AUTH_SECRET without revealing it', () => {
		const message = validationMessage(envWith({ BETTER_AUTH_SECRET: 'short-secret-value' }));

		expect(message).toContain('BETTER_AUTH_SECRET: must be at least 32 characters long');
		expect(message).not.toContain('short-secret-value');
	});

	it.each([
		'https://cms.example.com/',
		'https://cms.example.com/panel',
		'https://cms.example.com?page=1',
		'ftp://cms.example.com',
		'cms.example.com'
	])('rejects %s as ORIGIN', (origin) => {
		expect(validationMessage(envWith({ ORIGIN: origin }))).toContain('ORIGIN:');
	});

	it('accepts an http origin with a port', () => {
		const env = parseEnv(envWith({ ORIGIN: 'http://localhost:5173' }));

		expect(env.ORIGIN).toBe('http://localhost:5173');
	});

	it('treats empty values as unset', () => {
		const env = parseEnv(envWith({ DATABASE_PATH: '', LOG_LEVEL: '', SMTP_HOST: '' }));

		expect(env.DATABASE_PATH).toBe('/data/servitor.db');
		expect(env.LOG_LEVEL).toBe('info');
		expect(env.SMTP_HOST).toBeUndefined();
	});

	it('accepts only true or false for boolean flags', () => {
		const env = parseEnv(envWith({ WEBHOOK_ALLOW_PRIVATE: 'true' }));
		const message = validationMessage(envWith({ WEBHOOK_ALLOW_PRIVATE: 'yes' }));

		expect(env.WEBHOOK_ALLOW_PRIVATE).toBe(true);
		expect(message).toContain('WEBHOOK_ALLOW_PRIVATE:');
	});

	it('rejects an unknown LOG_LEVEL', () => {
		expect(validationMessage(envWith({ LOG_LEVEL: 'verbose' }))).toContain('LOG_LEVEL:');
	});

	it('accepts a complete SMTP configuration', () => {
		const env = parseEnv(envWith(SMTP_ENV));

		expect(env.SMTP_PORT).toBe(587);
		expect(env.SMTP_SECURE).toBe(false);
		expect(env.SMTP_FROM).toBe('Servitor <cms@example.com>');
	});

	it('accepts a partial SMTP configuration and reports the missing keys', () => {
		const env = parseEnv(envWith({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587' }));

		expect(missingSmtpKeys(env)).toEqual([
			'SMTP_USER',
			'SMTP_PASSWORD',
			'SMTP_FROM',
			'SMTP_SECURE'
		]);
	});

	it('reports no missing SMTP keys when email is fully configured or not configured', () => {
		expect(missingSmtpKeys(parseEnv(envWith(SMTP_ENV)))).toEqual([]);
		expect(missingSmtpKeys(parseEnv(envWith()))).toEqual([]);
	});

	it.each(['not-an-email', 'Servitor <not-an-email>', 'Servitor\r\n<cms@example.com>'])(
		'rejects %j as SMTP_FROM',
		(from) => {
			const message = validationMessage(envWith({ ...SMTP_ENV, SMTP_FROM: from }));

			expect(message).toContain('SMTP_FROM:');
		}
	);

	it('rejects an SMTP_PORT outside the valid range', () => {
		const message = validationMessage(envWith({ ...SMTP_ENV, SMTP_PORT: '70000' }));

		expect(message).toContain('SMTP_PORT:');
	});

	it('leaves the first-start seed variables to the seeding step', () => {
		const env = parseEnv(
			envWith({ FOUNDER_EMAIL: 'not-an-email', DEFAULT_CONTENT_LANGUAGE: 'tr' })
		);

		expect(env.FOUNDER_EMAIL).toBe('not-an-email');
		expect(env.DEFAULT_CONTENT_LANGUAGE).toBe('tr');
	});

	it('validates the reverse proxy settings', () => {
		const env = parseEnv(envWith({ ADDRESS_HEADER: 'x-forwarded-for', XFF_DEPTH: '2' }));
		const depthMessage = validationMessage(envWith({ XFF_DEPTH: '0' }));
		const headerMessage = validationMessage(envWith({ ADDRESS_HEADER: 'x forwarded for' }));

		expect(env.XFF_DEPTH).toBe(2);
		expect(depthMessage).toContain('XFF_DEPTH:');
		expect(headerMessage).toContain('ADDRESS_HEADER:');
	});
});
