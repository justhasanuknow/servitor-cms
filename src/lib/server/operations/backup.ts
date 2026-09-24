import { randomUUID } from 'node:crypto';
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
import Database from 'better-sqlite3';
import { create, extract, list } from 'tar';
import type { Env } from '../config/env';
import type { AppDatabase } from '../db';
import type {
	ArchiveSize,
	BackupManifest,
	DataPaths,
	RestoreLimits,
	RestoreResult
} from './backup.interfaces';
import { instanceRunning } from './instance';

const FORMAT = 1;

const DATABASE_ENTRY = 'servitor.db';

const MANIFEST_ENTRY = 'backup.json';

const UPLOADS_ENTRY = 'uploads';

const STAGING_PREFIX = '.staging-';

const SQLITE_SIDE_FILES = ['-wal', '-shm'];

const ALLOWED_ENTRY_TYPES = new Set(['File', 'OldFile', 'Directory']);

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

function timestamp(date: Date): string {
	return date
		.toISOString()
		.replaceAll(':', '-')
		.replace(/\.\d{3}Z$/, 'Z');
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);

		return true;
	} catch {
		return false;
	}
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

export async function createBackup(
	db: AppDatabase,
	paths: DataPaths,
	now: Date = new Date()
): Promise<string> {
	const staging = join(paths.dataDir, `.backup-${randomUUID()}`);
	const archive = join(paths.backupsDir, `servitor-backup-${timestamp(now)}.tar.gz`);
	const partial = `${archive}.partial`;
	const manifest: BackupManifest = { format: FORMAT, createdAt: now.toISOString() };

	await mkdir(paths.backupsDir, { recursive: true });
	await mkdir(staging, { recursive: true });

	try {
		await db.$client.backup(join(staging, DATABASE_ENTRY));
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

async function archiveProblem(archive: string, limits: RestoreLimits): Promise<string | null> {
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
		return problems[0];
	}

	if (!names.has(DATABASE_ENTRY) || !names.has(MANIFEST_ENTRY)) {
		return 'the archive does not contain a database and a manifest';
	}

	return archiveSizeProblem(size, limits);
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

async function freeBytes(directory: string): Promise<number> {
	await mkdir(directory, { recursive: true });

	const stats = await statfs(directory);

	return stats.bavail * stats.bsize;
}

async function manifestProblem(staging: string): Promise<string | null> {
	try {
		const manifest: unknown = JSON.parse(await readFile(join(staging, MANIFEST_ENTRY), 'utf8'));

		if (
			typeof manifest !== 'object' ||
			manifest === null ||
			!('format' in manifest) ||
			manifest.format !== FORMAT
		) {
			return 'the backup format is not supported';
		}

		return null;
	} catch {
		return 'the manifest cannot be read';
	}
}

function databaseProblem(path: string): string | null {
	try {
		const database = new Database(path, { readonly: true, fileMustExist: true });

		try {
			const result = database.pragma('integrity_check', { simple: true });

			if (result !== 'ok') {
				return 'the database failed its integrity check';
			}

			return null;
		} finally {
			database.close();
		}
	} catch {
		return 'the database cannot be opened';
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
	const listed = await archiveProblem(archive, effectiveLimits).catch(
		() => 'the archive cannot be read'
	);

	if (listed !== null) {
		return { status: 'invalid_archive', reason: listed };
	}

	const staging = join(paths.dataDir, `.restore-${randomUUID()}`);

	await mkdir(staging, { recursive: true });

	try {
		await extract({
			file: archive,
			cwd: staging,
			strict: true,
			filter: (path, entry) => 'type' in entry && entryProblem(path, entry.type) === null
		});

		const problem =
			(await manifestProblem(staging)) ?? databaseProblem(join(staging, DATABASE_ENTRY));

		if (problem !== null) {
			return { status: 'invalid_archive', reason: problem };
		}

		const previousDataDir = join(paths.dataDir, `.pre-restore-${timestamp(now)}`);

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
