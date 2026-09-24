import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase, type AppDatabase } from '../db';
import { systemSettings } from '../db/schema';
import type { DataPaths } from './backup.interfaces';
import { createBackup } from './backup';
import {
	applyPendingRestore,
	hasPendingRestore,
	readRestoreOutcome,
	requestRestore,
	restoreProblem
} from './restore-request';

let root: string;

let paths: DataPaths;

let db: AppDatabase;

beforeEach(() => {
	root = resolve('.tmp', 'tests', `restore-request-${crypto.randomUUID()}`);
	paths = {
		dataDir: root,
		databasePath: join(root, 'servitor.db'),
		uploadsDir: join(root, 'uploads'),
		backupsDir: join(root, 'backups')
	};
	mkdirSync(paths.uploadsDir, { recursive: true });
	db = openDatabase(paths.databasePath);
	migrateDatabase(db, MIGRATIONS_FOLDER);
});

afterEach(() => {
	db.$client.close();
	rmSync(root, { recursive: true, force: true });
});

function siteName(): string {
	const database = new Database(paths.databasePath, { readonly: true });

	try {
		const row: unknown = database.prepare('select site_name from system_settings').get();

		if (typeof row === 'object' && row !== null && 'site_name' in row) {
			return String(row.site_name);
		}

		return '';
	} finally {
		database.close();
	}
}

describe('pending restores', () => {
	it('does nothing without a request', async () => {
		expect(await applyPendingRestore(paths)).toBeNull();
		expect(await readRestoreOutcome(paths)).toBeNull();
	});

	it('applies a requested backup before the app opens the database', async () => {
		db.update(systemSettings)
			.set({ siteName: 'From the backup' })
			.where(eq(systemSettings.id, 1))
			.run();

		const archive = await createBackup(db, paths, { source: 'panel' });

		db.update(systemSettings)
			.set({ siteName: 'Changed later' })
			.where(eq(systemSettings.id, 1))
			.run();
		db.$client.close();

		await requestRestore(paths, {
			archive: basename(archive),
			requestedBy: 'founder@example.com',
			requestedAt: new Date().toISOString()
		});

		expect(await hasPendingRestore(paths)).toBe(true);

		const outcome = await applyPendingRestore(paths, new Date('2026-09-24T12:00:00.000Z'));

		expect(outcome).toMatchObject({
			status: 'restored',
			archive: basename(archive),
			requestedBy: 'founder@example.com',
			previousDataDir: '.pre-restore-2026-09-24T12-00-00Z'
		});
		expect(await hasPendingRestore(paths)).toBe(false);
		expect(await readRestoreOutcome(paths)).toEqual(outcome);
		expect(siteName()).toBe('From the backup');
		db = openDatabase(paths.databasePath);
	});

	it('keeps the data and reports why a restore failed', async () => {
		db.update(systemSettings)
			.set({ siteName: 'Current' })
			.where(eq(systemSettings.id, 1))
			.run();
		await requestRestore(paths, {
			archive: 'servitor-backup-2026-09-24T12-00-00Z.tar.gz',
			requestedBy: 'founder@example.com',
			requestedAt: new Date().toISOString()
		});

		const outcome = await applyPendingRestore(paths);

		expect(outcome).toMatchObject({ status: 'failed', problem: 'damaged' });
		expect(await readRestoreOutcome(paths)).toMatchObject({ status: 'failed' });
		expect(siteName()).toBe('Current');
		expect(existsSync(join(paths.backupsDir, 'restore-pending.json'))).toBe(false);
	});

	it('refuses a request that points outside the backups folder', async () => {
		mkdirSync(paths.backupsDir, { recursive: true });
		writeFileSync(
			join(paths.backupsDir, 'restore-pending.json'),
			JSON.stringify({
				archive: '../servitor.db',
				requestedBy: 'x',
				requestedAt: new Date().toISOString()
			})
		);

		expect(await applyPendingRestore(paths)).toMatchObject({
			status: 'failed',
			reason: 'the restore request cannot be read'
		});
		expect(readFileSync(paths.databasePath).length).toBeGreaterThan(0);
	});
});

describe('restoreProblem', () => {
	it.each([
		['the backup was created by a newer or different version of Servitor CMS', 'newer_version'],
		['the database schema does not match its migrations', 'schema'],
		['the database was not created by Servitor CMS', 'foreign'],
		['the unpacked archive would not fit into the free space of the data volume', 'space'],
		['the archive has more than 500000 entries', 'space'],
		['unsafe path ../x', 'contents'],
		['the archive does not contain a database and a manifest', 'foreign'],
		['the backup format is not supported', 'format'],
		['the database failed its integrity check', 'damaged']
	])('turns "%s" into %s', (reason, problem) => {
		expect(restoreProblem(reason)).toBe(problem);
	});
});
