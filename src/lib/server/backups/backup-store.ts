import type { Stats } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ARCHIVE_NAME_PATTERN } from '../../constants/backups';
import type { DataPaths } from '../operations/backup.interfaces';
import { freeBytes, readArchiveManifest } from '../operations/backup';
import type {
	ArchiveEntry,
	ArchiveKind,
	CachedArchive,
	StorageSummary
} from './backups.interfaces';

const ARCHIVE_NAME = ARCHIVE_NAME_PATTERN;

const manifestCache = new Map<string, CachedArchive>();

export function isArchiveName(name: string): boolean {
	return ARCHIVE_NAME.test(name);
}

export function archivePath(paths: DataPaths, name: string): string | null {
	if (!isArchiveName(name)) {
		return null;
	}

	return join(paths.backupsDir, name);
}

export function archiveKind(name: string): ArchiveKind | null {
	const match = ARCHIVE_NAME.exec(name);

	if (match === null) {
		return null;
	}

	return kindOf(match[1]);
}

export function archiveTime(name: string): Date | null {
	const match = ARCHIVE_NAME.exec(name);

	if (match === null) {
		return null;
	}

	const time = new Date(`${match[2]}T${match[3]}:${match[4]}:${match[5]}Z`);

	if (Number.isNaN(time.getTime())) {
		return null;
	}

	return time;
}

function kindOf(value: string): ArchiveKind {
	if (value === 'auto' || value === 'upload') {
		return value;
	}

	return 'backup';
}

async function archiveNames(paths: DataPaths): Promise<string[]> {
	try {
		return (await readdir(paths.backupsDir)).filter(isArchiveName);
	} catch {
		return [];
	}
}

async function describeArchive(paths: DataPaths, name: string): Promise<ArchiveEntry | null> {
	const path = join(paths.backupsDir, name);
	let details: Stats;

	try {
		details = await stat(path);
	} catch {
		return null;
	}

	if (!details.isFile()) {
		return null;
	}

	const key = `${details.size}:${details.mtimeMs}`;
	const cached = manifestCache.get(path);

	if (cached !== undefined && cached.key === key) {
		return cached.entry;
	}

	const manifest = await readArchiveManifest(path);
	const kind = kindOf(ARCHIVE_NAME.exec(name)?.[1] ?? 'backup');
	let createdAt = archiveTime(name) ?? details.mtime;
	let source: ArchiveEntry['source'] = null;

	if (manifest !== null) {
		createdAt = new Date(manifest.createdAt);
		source = manifest.source ?? null;
	}

	if (kind === 'upload') {
		source = 'upload';
	}

	const entry: ArchiveEntry = {
		name,
		kind,
		size: details.size,
		createdAt,
		appVersion: manifest?.appVersion ?? null,
		source
	};

	manifestCache.set(path, { key, entry });

	return entry;
}

export async function listArchives(paths: DataPaths): Promise<ArchiveEntry[]> {
	const entries = await Promise.all(
		(await archiveNames(paths)).map((name) => describeArchive(paths, name))
	);

	return entries
		.filter((entry): entry is ArchiveEntry => entry !== null)
		.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export async function storageSummary(paths: DataPaths): Promise<StorageSummary> {
	const archives = await listArchives(paths);

	return {
		freeBytes: await freeBytes(paths.backupsDir),
		archiveBytes: archives.reduce((total, archive) => total + archive.size, 0)
	};
}

export async function deleteArchive(paths: DataPaths, name: string): Promise<boolean> {
	const path = archivePath(paths, name);

	if (path === null) {
		return false;
	}

	try {
		const details = await stat(path);

		if (!details.isFile()) {
			return false;
		}
	} catch {
		return false;
	}

	await rm(path, { force: true });
	manifestCache.delete(path);

	return true;
}

export async function newestScheduledArchive(paths: DataPaths): Promise<Date | null> {
	const times = (await archiveNames(paths))
		.filter((name) => archiveKind(name) === 'auto')
		.map((name) => archiveTime(name))
		.filter((time): time is Date => time !== null)
		.sort((left, right) => right.getTime() - left.getTime());

	return times[0] ?? null;
}

export async function pruneScheduledArchives(paths: DataPaths, keep: number): Promise<string[]> {
	const scheduled = (await archiveNames(paths))
		.filter((name) => archiveKind(name) === 'auto')
		.sort()
		.reverse();
	const removed: string[] = [];

	for (const name of scheduled.slice(keep)) {
		if (await deleteArchive(paths, name)) {
			removed.push(name);
		}
	}

	return removed;
}
