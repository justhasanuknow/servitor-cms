import { isIPv4 } from 'node:net';
import nodemailer from 'nodemailer';
import type { Logger } from 'pino';
import { missingSmtpKeys, type Env } from '../config/env';
import type { EmailMessage, Mailer } from './mailer.interfaces';

const CONNECTION_TIMEOUT_MS = 10_000;

const SOCKET_TIMEOUT_MS = 20_000;

export const disabledMailer: Mailer = {
	enabled: false,
	send: async () => {
		throw new Error('Email is not configured');
	}
};

export function smtpConfigured(env: Env): boolean {
	return env.SMTP_HOST !== undefined && missingSmtpKeys(env).length === 0;
}

export function createMailer(env: Env): Mailer {
	if (!smtpConfigured(env)) {
		return disabledMailer;
	}

	const transport = nodemailer.createTransport(smtpTransportOptions(env));

	return {
		enabled: true,
		send: async (message: EmailMessage) => {
			await transport.sendMail({
				from: env.SMTP_FROM,
				to: message.to,
				subject: message.subject,
				text: message.text,
				html: message.html
			});
		}
	};
}

export function smtpTransportOptions(env: Env) {
	return {
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		requireTLS: !isLoopbackHost(env.SMTP_HOST ?? ''),
		tls: { minVersion: 'TLSv1.2' as const, rejectUnauthorized: true },
		auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
		connectionTimeout: CONNECTION_TIMEOUT_MS,
		greetingTimeout: CONNECTION_TIMEOUT_MS,
		socketTimeout: SOCKET_TIMEOUT_MS
	};
}

export function isLoopbackHost(host: string): boolean {
	const normalized = host.toLowerCase().replace(/^\[(.*)\]$/, '$1');

	if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1') {
		return true;
	}

	return isIPv4(normalized) && normalized.startsWith('127.');
}

export function sendInBackground(mailer: Mailer, logger: Logger, message: EmailMessage): void {
	mailer.send(message).catch((error: unknown) => {
		logger.error({ err: error }, 'An email could not be sent');
	});
}
