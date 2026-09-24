import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
	copyFile,
	link,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	stat,
	statfs,
	writeFile
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createGunzip } from 'node:zlib';
import Database from 'better-sqlite3';
import { create, extract, list, Parser, type ReadEntry } from 'tar';
import { version } from '../../../../package.json';
import type { Env } from '../config/env';
import { MIGRATIONS_FOLDER, type AppDatabase } from '../db';
import type {
	ArchiveCheckResult,
	ArchiveSize,
	BackupManifest,
	CreateBackupOptions,
	CreatedBackupSource,
	DataPaths,
	RestoreLimits,
	RestoreResult
} from './backup.interfaces';
import { databaseSchemaProblem } from './backup-schema';
import { instanceRunning } from './instance';

const FORMAT = 2;

const SUPPORTED_FORMATS = new Set([1, 2]);

const CREATED_SOURCES = new Set<string>(['cli', 'panel', 'schedule']);

const DATABASE_ENTRY = 'servitor.db';

const MANIFEST_ENTRY = 'backup.json';

const UPLOADS_ENTRY = 'uploads';

const STAGING_PREFIX = '.staging-';

const SQLITE_SIDE_FILES = ['-wal', '-shm'];

const ALLOWED_ENTRY_TYPES = new Set(['File', 'OldFile', 'Directory']);

const MAX_MANIFEST_BYTES = 64 * 1024;

const TRANSIENT_TABLES = ['session', 'verification'];

export const ARCHIVE_EXTENSION = '.tar.gz';

export const MAX_RESTORE_ENTRIES = 500_000;

export function dataPaths(env: Env): DataPaths {
	const databasePath = resolve(env.DATABASE_PATH);
	const dataDir = dirname(databasePath);

	return {
		dataDir,
		databasePath,
		uploadsDir: resolve(env.UPLOADS_DIR),
		backupsDir: join(dataDir, 'backups')
	};
}

export function appVersion(): string {
	return version;
}

export function timestamp(date: Date): string {
	return date
		.toISOString()
		.replaceAll(':', '-')
		.replace(/\.\d{3}Z$/, 'Z');
}

export async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);

		return true;
	} catch {
		return false;
	}
}

export async function uniqueArchivePath(directory: string, stem: string): Promise<string> {
	let candidate = join(directory, `${stem}${ARCHIVE_EXTENSION}`);

	for (let suffix = 1; await exists(candidate); suffix += 1) {
		candidate = join(directory, `${stem}-${suffix}${ARCHIVE_EXTENSION}`);
	}

	return candidate;
}

export async function freeBytes(directory: string): Promise<number> {
	await mkdir(directory, { recursive: true });

	const stats = await statfs(directory);

	return stats.bavail * stats.bsize;
}

async function linkTree(source: string, target: string): Promise<void> {
	await mkdir(target, { recursive: true });

	for (const entry of await readdir(source, { withFileTypes: true })) {
		if (entry.name.startsWith(STAGING_PREFIX)) {
			continue;
		}

		const from = join(source, entry.name);
		const to = join(target, entry.name);

		if (entry.isDirectory()) {
			await linkTree(from, to);
		} else if (entry.isFile()) {
			await link(from, to).catch(() => copyFile(from, to));
		}
	}
}

function archiveStem(source: CreatedBackupSource, now: Date): string {
	if (source === 'schedule') {
		return `servitor-auto-${timestamp(now)}`;
	}

	return `servitor-backup-${timestamp(now)}`;
}

export function removeTransientData(path: string): void {
	const database = new Database(path, { fileMustExist: true });

	try {
		for (const table of TRANSIENT_TABLES) {
			database.exec(`delete from "${table}"`);
		}

		database.exec('vacuum');
		database.pragma('journal_mode = DELETE');
	} finally {
		database.close();
	}
}

export async function createBackup(
	db: AppDatabase,
	paths: DataPaths,
	options: CreateBackupOptions = {}
): Promise<string> {
	const now = options.now ?? new Date();
	const source = options.source ?? 'cli';
	const staging = join(paths.dataDir, `.backup-${randomUUID()}`);
	const manifest: BackupManifest = {
		format: FORMAT,
		createdAt: now.toISOString(),
		appVersion: appVersion(),
		source
	};

	await mkdir(paths.backupsDir, { recursive: true });
	await mkdir(staging, { recursive: true });

	const archive = await uniqueArchivePath(paths.backupsDir, archiveStem(source, now));
	const partial = `${archive}.partial`;

	try {
		await db.$client.backup(join(staging, DATABASE_ENTRY));
		removeTransientData(join(staging, DATABASE_ENTRY));
		await writeFile(join(staging, MANIFEST_ENTRY), `${JSON.stringify(manifest)}\n`);

		const entries = [MANIFEST_ENTRY, DATABASE_ENTRY];

		if (await exists(paths.uploadsDir)) {
			await linkTree(paths.uploadsDir, join(staging, UPLOADS_ENTRY));
			entries.push(UPLOADS_ENTRY);
		}

		await create({ cwd: staging, file: partial, gzip: true, portable: true }, entries);
		await rename(partial, archive);

		return archive;
	} finally {
		await rm(staging, { recursive: true, force: true });
		await rm(partial, { force: true });
	}
}

function entryProblem(path: string, type: string): string | null {
	const segments = path.replace(/\/$/, '').split('/');

	if (
		path.startsWith('/') ||
		path.includes('\\') ||
		segments.some((part) => part === '..' || part === '')
	) {
		return `unsafe path ${path}`;
	}

	if (!ALLOWED_ENTRY_TYPES.has(type)) {
		return `unsupported entry ${path}`;
	}

	if (segments[0] === MANIFEST_ENTRY || segments[0] === DATABASE_ENTRY) {
		if (segments.length !== 1 || type === 'Directory') {
			return `unexpected entry ${path}`;
		}

		return null;
	}

	if (segments[0] !== UPLOADS_ENTRY) {
		return `unexpected entry ${path}`;
	}

	return null;
}

async function archiveProblem(
	archive: string,
	limits: RestoreLimits
): Promise<{ problem: string | null; size: ArchiveSize }> {
	const problems: string[] = [];
	const names = new Set<string>();
	const size: ArchiveSize = { entries: 0, bytes: 0 };

	await list({
		file: archive,
		onReadEntry: (entry) => {
			const problem = entryProblem(entry.path, entry.type);

			if (problem !== null) {
				problems.push(problem);
			}

			names.add(entry.path);
			size.entries += 1;
			size.bytes += entry.size;
		}
	});

	if (problems.length > 0) {
		return { problem: problems[0], size };
	}

	if (!names.has(DATABASE_ENTRY) || !names.has(MANIFEST_ENTRY)) {
		return { problem: 'the archive does not contain a database and a manifest', size };
	}

	return { problem: archiveSizeProblem(size, limits), size };
}

export function archiveSizeProblem(size: ArchiveSize, limits: RestoreLimits): string | null {
	if (size.entries > limits.maxEntries) {
		return `the archive has more than ${limits.maxEntries} entries`;
	}

	if (size.bytes > limits.maxBytes) {
		return 'the unpacked archive would not fit into the free space of the data volume';
	}

	return null;
}

export function parseManifest(text: string): BackupManifest | null {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!('format' in parsed) ||
		typeof parsed.format !== 'number' ||
		!SUPPORTED_FORMATS.has(parsed.format) ||
		!('createdAt' in parsed) ||
		typeof parsed.createdAt !== 'string' ||
		Number.isNaN(Date.parse(parsed.createdAt))
	) {
		return null;
	}

	const manifest: BackupManifest = { format: parsed.format, createdAt: parsed.createdAt };

	if ('appVersion' in parsed && typeof parsed.appVersion === 'string') {
		manifest.appVersion = parsed.appVersion.slice(0, 64);
	}

	if ('source' in parsed && typeof parsed.source === 'string') {
		const source = parsed.source;

		if (isCreatedSource(source)) {
			manifest.source = source;
		}
	}

	return manifest;
}

function isCreatedSource(value: string): value is CreatedBackupSource {
	return CREATED_SOURCES.has(value);
}

async function stagedManifest(staging: string): Promise<BackupManifest | null> {
	try {
		return parseManifest(await readFile(join(staging, MANIFEST_ENTRY), 'utf8'));
	} catch {
		return null;
	}
}

function databaseProblem(path: string): string | null {
	try {
		const database = new Database(path, { readonly: true, fileMustExist: true });

		try {
			database.pragma('trusted_schema = OFF');

			const result = database.pragma('integrity_check', { simple: true });

			if (result !== 'ok') {
				return 'the database failed its integrity check';
			}
		} finally {
			database.close();
		}
	} catch {
		return 'the database cannot be opened';
	}

	try {
		return databaseSchemaProblem(path, MIGRATIONS_FOLDER);
	} catch {
		return 'the database schema cannot be read';
	}
}

export async function readArchiveManifest(archive: string): Promise<BackupManifest | null> {
	return new Promise((resolveManifest) => {
		const source = createReadStream(archive);
		const gunzip = createGunzip();
		const parser = new Parser();
		let settled = false;

		const finish = (manifest: BackupManifest | null) => {
			if (settled) {
				return;
			}

			settled = true;
			resolveManifest(manifest);
			source.destroy();
			gunzip.destroy();
		};

		parser.on('entry', (entry: ReadEntry) => {
			if (entry.path !== MANIFEST_ENTRY || entry.size > MAX_MANIFEST_BYTES) {
				finish(null);

				return;
			}

			const chunks: Buffer[] = [];

			entry.on('data', (chunk: Buffer) => chunks.push(chunk));
			entry.on('end', () => finish(parseManifest(Buffer.concat(chunks).toString('utf8'))));
		});
		parser.on('end', () => finish(null));
		source.on('error', () => finish(null));
		gunzip.on('error', () => finish(null));
		parser.on('error', () => finish(null));
		source.pipe(gunzip).pipe(parser);
	});
}

export async function checkArchive(
	archive: string,
	scratchDir: string,
	limits: Partial<RestoreLimits> = {}
): Promise<ArchiveCheckResult> {
	const effectiveLimits: RestoreLimits = {
		maxEntries: limits.maxEntries ?? MAX_RESTORE_ENTRIES,
		maxBytes: limits.maxBytes ?? (await freeBytes(scratchDir))
	};
	const listed = await archiveProblem(archive, effectiveLimits).catch(() => ({
		problem: 'the archive cannot be read',
		size: { entries: 0, bytes: 0 }
	}));

	if (listed.problem !== null) {
		return { status: 'invalid_archive', reason: listed.problem };
	}

	const staging = join(scratchDir, `.check-${randomUUID()}`);

	await mkdir(staging, { recursive: true });

	try {
		await extract({
			file: archive,
			cwd: staging,
			strict: true,
			filter: (path) => path === MANIFEST_ENTRY || path === DATABASE_ENTRY
		});

		const manifest = await stagedManifest(staging);

		if (manifest === null) {
			return { status: 'invalid_archive', reason: 'the backup format is not supported' };
		}

		const problem = databaseProblem(join(staging, DATABASE_ENTRY));

		if (problem !== null) {
			return { status: 'invalid_archive', reason: problem };
		}

		return { status: 'valid', manifest, size: listed.size };
	} catch {
		return { status: 'invalid_archive', reason: 'the archive cannot be read' };
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

async function moveIfPresent(from: string, to: string): Promise<void> {
	if (await exists(from)) {
		await mkdir(dirname(to), { recursive: true });
		await rename(from, to);
	}
}

export async function restoreBackup(
	paths: DataPaths,
	archive: string,
	force: boolean,
	now: Date = new Date(),
	limits: Partial<RestoreLimits> = {}
): Promise<RestoreResult> {
	if (!force && instanceRunning(paths.dataDir, now)) {
		return { status: 'running' };
	}

	const effectiveLimits: RestoreLimits = {
		maxEntries: limits.maxEntries ?? MAX_RESTORE_ENTRIES,
		maxBytes: limits.maxBytes ?? (await freeBytes(paths.dataDir))
	};
	const listed = await archiveProblem(archive, effectiveLimits).catch(() => ({
		problem: 'the archive cannot be read',
		size: { entries: 0, bytes: 0 }
	}));

	if (listed.problem !== null) {
		return { status: 'invalid_archive', reason: listed.problem };
	}

	const staging = join(paths.dataDir, `.restore-${randomUUID()}`);

	await mkdir(staging, { recursive: true });

	try {
		const problem = await stagedArchiveProblem(archive, staging);

		if (problem !== null) {
			return { status: 'invalid_archive', reason: problem };
		}

		const previousDataDir = await uniqueDirectory(
			join(paths.dataDir, `.pre-restore-${timestamp(now)}`)
		);

		await mkdir(previousDataDir, { recursive: true });

		for (const suffix of ['', ...SQLITE_SIDE_FILES]) {
			await moveIfPresent(
				`${paths.databasePath}${suffix}`,
				join(previousDataDir, `${DATABASE_ENTRY}${suffix}`)
			);
		}

		await moveIfPresent(paths.uploadsDir, join(previousDataDir, UPLOADS_ENTRY));
		await rename(join(staging, DATABASE_ENTRY), paths.databasePath);

		if (await exists(join(staging, UPLOADS_ENTRY))) {
			await rename(join(staging, UPLOADS_ENTRY), paths.uploadsDir);
		} else {
			await mkdir(paths.uploadsDir, { recursive: true });
		}

		return { status: 'restored', previousDataDir };
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

async function stagedArchiveProblem(archive: string, staging: string): Promise<string | null> {
	try {
		await extract({
			file: archive,
			cwd: staging,
			strict: true,
			filter: (path, entry) => 'type' in entry && entryProblem(path, entry.type) === null
		});
	} catch {
		return 'the archive cannot be read';
	}

	if ((await stagedManifest(staging)) === null) {
		return 'the backup format is not supported';
	}

	const problem = databaseProblem(join(staging, DATABASE_ENTRY));

	if (problem !== null) {
		return problem;
	}

	removeTransientData(join(staging, DATABASE_ENTRY));

	return null;
}

async function uniqueDirectory(base: string): Promise<string> {
	let candidate = base;

	for (let suffix = 1; await exists(candidate); suffix += 1) {
		candidate = `${base}-${suffix}`;
	}

	return candidate;
}
