import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appVersion, createBackup, dataPaths } from '../operations/backup';
import type { DataPaths } from '../operations/backup.interfaces';
import { createTestRuntime } from '../testing/runtime';
import {
	archivePath,
	archiveTime,
	deleteArchive,
	isArchiveName,
	listArchives,
	newestScheduledArchive,
	pruneScheduledArchives,
	storageSummary
} from './backup-store';

let harness: ReturnType<typeof createTestRuntime>;

let paths: DataPaths;

beforeEach(() => {
	harness = createTestRuntime();
	paths = dataPaths(harness.runtime.env);
});

afterEach(() => {
	harness.dispose();
});

function scheduled(time: string): Promise<string> {
	return createBackup(harness.runtime.db, paths, { source: 'schedule', now: new Date(time) });
}

describe('backup store', () => {
	it('lists archives newest first with their manifests and ignores other files', async () => {
		const older = await createBackup(harness.runtime.db, paths, {
			source: 'panel',
			now: new Date('2026-09-20T10:00:00.000Z')
		});
		const newer = await scheduled('2026-09-24T03:00:00.000Z');

		writeFileSync(join(paths.backupsDir, 'notes.txt'), 'not an archive');
		mkdirSync(join(paths.backupsDir, 'servitor-backup-2026-09-01T00-00-00Z.tar.gz'));

		const archives = await listArchives(paths);

		expect(archives.map((archive) => archive.name)).toEqual([basename(newer), basename(older)]);
		expect(archives[0]).toMatchObject({
			kind: 'auto',
			source: 'schedule',
			appVersion: appVersion(),
			createdAt: new Date('2026-09-24T03:00:00.000Z')
		});
		expect(archives[1]).toMatchObject({ kind: 'backup', source: 'panel' });
		expect((await storageSummary(paths)).archiveBytes).toBe(
			archives[0].size + archives[1].size
		);
	});

	it('accepts only archive names inside the backups folder', () => {
		expect(isArchiveName('servitor-backup-2026-09-24T12-00-00Z.tar.gz')).toBe(true);
		expect(isArchiveName('servitor-upload-2026-09-24T12-00-00Z-2.tar.gz')).toBe(true);

		for (const name of [
			'../servitor-backup-2026-09-24T12-00-00Z.tar.gz',
			'servitor-backup-2026-09-24T12-00-00Z.tar.gz/../x',
			'servitor.db',
			'servitor-backup-latest.tar.gz'
		]) {
			expect(archivePath(paths, name)).toBeNull();
		}

		expect(archiveTime('servitor-auto-2026-09-24T03-00-00Z.tar.gz')).toEqual(
			new Date('2026-09-24T03:00:00.000Z')
		);
	});

	it('deletes archives and refuses other names', async () => {
		const archive = basename(await createBackup(harness.runtime.db, paths));

		expect(await deleteArchive(paths, '../servitor.db')).toBe(false);
		expect(await deleteArchive(paths, archive)).toBe(true);
		expect(await deleteArchive(paths, archive)).toBe(false);
		expect(await listArchives(paths)).toEqual([]);
	});

	it('keeps only the newest scheduled archives and never touches others', async () => {
		const manual = basename(await createBackup(harness.runtime.db, paths));

		await scheduled('2026-09-21T03:00:00.000Z');
		await scheduled('2026-09-22T03:00:00.000Z');

		const newest = basename(await scheduled('2026-09-23T03:00:00.000Z'));

		expect(await pruneScheduledArchives(paths, 1)).toHaveLength(2);
		expect((await listArchives(paths)).map((archive) => archive.name).sort()).toEqual(
			[manual, newest].sort()
		);
		expect(await newestScheduledArchive(paths)).toEqual(new Date('2026-09-23T03:00:00.000Z'));
	});
});
