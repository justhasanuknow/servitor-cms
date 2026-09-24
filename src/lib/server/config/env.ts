import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
	canonicalLanguageTag,
	isLanguageTag,
	MAX_LANGUAGE_TAG_LENGTH
} from '../languages/language-tags';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const SMTP_KEYS = [
	'SMTP_HOST',
	'SMTP_PORT',
	'SMTP_USER',
	'SMTP_PASSWORD',
	'SMTP_FROM',
	'SMTP_SECURE'
] as const;

export const FILE_SECRET_KEYS = [
	'BETTER_AUTH_SECRET',
	'BETTER_AUTH_PREVIOUS_SECRETS',
	'SMTP_PASSWORD',
	'FOUNDER_PASSWORD'
] as const;

const SECRET_MIN_LENGTH = 32;

const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

const MAILBOX_WITH_NAME_PATTERN = /^[^<>\r\n]*<([^<>\s]+)>$/;

const emailAddress = z.email();

const booleanFlag = z.stringbool({ truthy: ['true'], falsy: ['false'] });

const portNumber = z
	.string()
	.regex(/^[0-9]{1,5}$/, 'must be a whole number')
	.transform((value) => Number(value))
	.pipe(z.number().int().min(1).max(65535));

const positiveInteger = z
	.string()
	.regex(/^[0-9]{1,3}$/, 'must be a whole number')
	.transform((value) => Number(value))
	.pipe(z.number().int().min(1));

const envSchema = z.object({
	ORIGIN: z
		.string({ error: 'is required' })
		.max(2048)
		.refine(
			isHttpOrigin,
			'must be an http or https origin such as https://cms.example.com, without a path or trailing slash'
		),
	BETTER_AUTH_SECRET: z
		.string({ error: 'is required' })
		.min(SECRET_MIN_LENGTH, 'must be at least 32 characters long')
		.max(1024),
	BETTER_AUTH_PREVIOUS_SECRETS: z
		.string()
		.max(8192)
		.transform((value) =>
			value
				.split(',')
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0)
		)
		.pipe(
			z
				.array(
					z.string().min(SECRET_MIN_LENGTH, 'must list secrets of at least 32 characters')
				)
				.max(8)
		)
		.default([]),
	DATABASE_PATH: z.string().min(1).max(4096).default('/data/servitor.db'),
	UPLOADS_DIR: z.string().min(1).max(4096).default('/data/uploads'),
	FOUNDER_EMAIL: z.string().optional(),
	FOUNDER_NAME: z.string().optional(),
	FOUNDER_PASSWORD: z.string().optional(),
	DEFAULT_CONTENT_LANGUAGE: z
		.string()
		.max(MAX_LANGUAGE_TAG_LENGTH)
		.refine(isLanguageTag, 'must be a BCP 47 language tag such as en, de or pt-BR')
		.transform((value) => canonicalLanguageTag(value) ?? value)
		.default('en'),
	SMTP_HOST: z.string().max(253).optional(),
	SMTP_PORT: portNumber.optional(),
	SMTP_USER: z.string().max(512).optional(),
	SMTP_PASSWORD: z.string().max(1024).optional(),
	SMTP_FROM: z
		.string()
		.max(512)
		.refine(
			isMailbox,
			'must be an email address, optionally with a display name such as Servitor <cms@example.com>'
		)
		.optional(),
	SMTP_SECURE: booleanFlag.optional(),
	WEBHOOK_ALLOW_PRIVATE: booleanFlag.default(false),
	ADDRESS_HEADER: z
		.string()
		.max(256)
		.regex(HEADER_NAME_PATTERN, 'must be an HTTP header name')
		.optional(),
	XFF_DEPTH: positiveInteger.optional(),
	LOG_LEVEL: z.enum(LOG_LEVELS).default('info')
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
	constructor(problems: string[]) {
		const lines = problems.map((problem) => `- ${problem}`);

		super(['Invalid environment configuration:', ...lines].join('\n'));
		this.name = 'EnvValidationError';
	}
}

export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
	const result = envSchema.safeParse(normalizeSource(source));

	if (!result.success) {
		throw new EnvValidationError(result.error.issues.map(describeIssue));
	}

	return result.data;
}

export function readEnv(source: Readonly<Record<string, string | undefined>>): Env {
	return parseEnv(withSecretFiles(source));
}

export function withSecretFiles(
	source: Readonly<Record<string, string | undefined>>,
	readSecretFile: (path: string) => string = (path) => readFileSync(path, 'utf8')
): Record<string, string | undefined> {
	const resolved: Record<string, string | undefined> = { ...source };
	const problems: string[] = [];

	for (const key of FILE_SECRET_KEYS) {
		const path = source[`${key}_FILE`];

		if (path === undefined || path === '') {
			continue;
		}

		if (source[key] !== undefined && source[key] !== '') {
			problems.push(`${key}_FILE: set either ${key} or ${key}_FILE, not both`);
			continue;
		}

		try {
			resolved[key] = readSecretFile(path).replace(/\r?\n$/, '');
		} catch {
			problems.push(`${key}_FILE: the file cannot be read`);
		}
	}

	if (problems.length > 0) {
		throw new EnvValidationError(problems);
	}

	return resolved;
}

export function missingSmtpKeys(env: Env): string[] {
	const missingKeys = SMTP_KEYS.filter((key) => env[key] === undefined);

	if (missingKeys.length === SMTP_KEYS.length) {
		return [];
	}

	return missingKeys;
}

export function describeIssue(issue: { path: PropertyKey[]; message: string }): string {
	return `${issue.path.map(String).join('.')}: ${issue.message}`;
}

function normalizeSource(
	source: Readonly<Record<string, string | undefined>>
): Record<string, string | undefined> {
	const normalized: Record<string, string | undefined> = {};

	for (const key of Object.keys(envSchema.shape)) {
		const value = source[key];

		if (value === undefined || value === '') {
			normalized[key] = undefined;
		} else {
			normalized[key] = value;
		}
	}

	return normalized;
}

function isHttpOrigin(value: string): boolean {
	if (!URL.canParse(value)) {
		return false;
	}

	const url = new URL(value);

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return false;
	}

	return url.origin === value;
}

function isMailbox(value: string): boolean {
	const match = MAILBOX_WITH_NAME_PATTERN.exec(value);

	if (match) {
		return emailAddress.safeParse(match[1]).success;
	}

	return emailAddress.safeParse(value).success;
}
