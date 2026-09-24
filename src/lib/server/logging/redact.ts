const REDACTED = '[REDACTED]';

const MAX_DEPTH = 10;

const SENSITIVE_KEY_PARTS = [
	'password',
	'passwd',
	'secret',
	'token',
	'authorization',
	'cookie',
	'apikey',
	'privatekey',
	'credential',
	'totp',
	'backupcode'
];

const SECRET_PATTERNS: [RegExp, string][] = [
	[/\bsvt_[A-Za-z0-9_-]+/g, `svt_${REDACTED}`],
	[/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`]
];

export function isSensitiveKey(key: string): boolean {
	const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

	return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

export function redactString(value: string): string {
	let result = value;

	for (const [pattern, replacement] of SECRET_PATTERNS) {
		result = result.replace(pattern, replacement);
	}

	return result;
}

export function redactLogLine(line: string): string {
	let entry: unknown;

	try {
		entry = JSON.parse(line);
	} catch {
		return redactString(line);
	}

	return `${JSON.stringify(redactValue(entry, 0))}\n`;
}

function redactValue(value: unknown, depth: number): unknown {
	if (typeof value === 'string') {
		return redactString(value);
	}

	if (typeof value !== 'object' || value === null) {
		return value;
	}

	if (depth >= MAX_DEPTH) {
		return '[Truncated]';
	}

	if (Array.isArray(value)) {
		return value.map((item: unknown) => redactValue(item, depth + 1));
	}

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, redactEntry(key, item, depth)])
	);
}

function redactEntry(key: string, item: unknown, depth: number): unknown {
	if (isSensitiveKey(key)) {
		return REDACTED;
	}

	return redactValue(item, depth + 1);
}
