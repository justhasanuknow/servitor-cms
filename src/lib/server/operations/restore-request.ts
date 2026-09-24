import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { DataPaths } from './backup.interfaces';
import { exists, restoreBackup } from './backup';
import type { PendingRestore, RestoreOutcome, RestoreProblem } from './restore-request.interfaces';

const PENDING_FILE = 'restore-pending.json';

const RESULT_FILE = 'restore-result.json';

const PROBLEM_PATTERNS: [RegExp, RestoreProblem][] = [
	[/newer or different version/, 'newer_version'],
	[/schema/, 'schema'],
	[/not created by Servitor|does not contain a database/, 'foreign'],
	[/free space|more than \d+ entries/, 'space'],
	[/unsafe path|unexpected entry|unsupported entry/, 'contents'],
	[/format is not supported/, 'format']
];

export function restoreProblem(reason: string): RestoreProblem {
	const match = PROBLEM_PATTERNS.find(([pattern]) => pattern.test(reason));

	if (match === undefined) {
		return 'damaged';
	}

	return match[1];
}

function pendingPath(paths: DataPaths): string {
	return join(paths.backupsDir, PENDING_FILE);
}

function resultPath(paths: DataPaths): string {
	return join(paths.backupsDir, RESULT_FILE);
}

async function writeJson(path: string, value: unknown): Promise<void> {
	const partial = `${path}.partial`;

	await writeFile(partial, `${JSON.stringify(value)}\n`);
	await rename(partial, path);
}

export async function requestRestore(paths: DataPaths, request: PendingRestore): Promise<void> {
	await mkdir(paths.backupsDir, { recursive: true });
	await writeJson(pendingPath(paths), request);
}

export async function hasPendingRestore(paths: DataPaths): Promise<boolean> {
	return exists(pendingPath(paths));
}

function parsePending(text: string): PendingRestore | null {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!('archive' in parsed) ||
		typeof parsed.archive !== 'string' ||
		basename(parsed.archive) !== parsed.archive ||
		!('requestedBy' in parsed) ||
		typeof parsed.requestedBy !== 'string' ||
		!('requestedAt' in parsed) ||
		typeof parsed.requestedAt !== 'string'
	) {
		return null;
	}

	return {
		archive: parsed.archive,
		requestedBy: parsed.requestedBy,
		requestedAt: parsed.requestedAt
	};
}

export async function applyPendingRestore(
	paths: DataPaths,
	now: Date = new Date()
): Promise<RestoreOutcome | null> {
	let text: string;

	try {
		text = await readFile(pendingPath(paths), 'utf8');
	} catch {
		return null;
	}

	await rm(pendingPath(paths), { force: true });

	const pending = parsePending(text);

	if (pending === null) {
		return saveOutcome(paths, {
			status: 'failed',
			archive: '',
			requestedBy: '',
			finishedAt: now.toISOString(),
			problem: 'damaged',
			reason: 'the restore request cannot be read'
		});
	}

	const result = await restoreBackup(
		paths,
		join(paths.backupsDir, pending.archive),
		true,
		now
	).catch((error: unknown) => ({
		status: 'invalid_archive' as const,
		reason: errorText(error)
	}));

	if (result.status === 'restored') {
		return saveOutcome(paths, {
			status: 'restored',
			archive: pending.archive,
			requestedBy: pending.requestedBy,
			finishedAt: now.toISOString(),
			previousDataDir: basename(result.previousDataDir)
		});
	}

	let reason = 'the app was still running';

	if (result.status === 'invalid_archive') {
		reason = result.reason;
	}

	return saveOutcome(paths, {
		status: 'failed',
		archive: pending.archive,
		requestedBy: pending.requestedBy,
		finishedAt: now.toISOString(),
		problem: restoreProblem(reason),
		reason
	});
}

function errorText(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

async function saveOutcome(paths: DataPaths, outcome: RestoreOutcome): Promise<RestoreOutcome> {
	await mkdir(paths.backupsDir, { recursive: true });
	await writeJson(resultPath(paths), outcome);

	return outcome;
}

export async function readRestoreOutcome(paths: DataPaths): Promise<RestoreOutcome | null> {
	let parsed: unknown;

	try {
		parsed = JSON.parse(await readFile(resultPath(paths), 'utf8'));
	} catch {
		return null;
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!('status' in parsed) ||
		!('archive' in parsed) ||
		typeof parsed.archive !== 'string' ||
		!('finishedAt' in parsed) ||
		typeof parsed.finishedAt !== 'string'
	) {
		return null;
	}

	const requestedBy = stringValue(parsed, 'requestedBy');

	if (parsed.status === 'restored') {
		return {
			status: 'restored',
			archive: parsed.archive,
			requestedBy,
			finishedAt: parsed.finishedAt,
			previousDataDir: stringValue(parsed, 'previousDataDir')
		};
	}

	const reason = stringValue(parsed, 'reason');

	return {
		status: 'failed',
		archive: parsed.archive,
		requestedBy,
		finishedAt: parsed.finishedAt,
		problem: restoreProblem(reason),
		reason
	};
}

function stringValue(value: object, key: string): string {
	const field: unknown = Reflect.get(value, key);

	if (typeof field === 'string') {
		return field;
	}

	return '';
}
