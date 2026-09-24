import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { create, extract, list } from 'tar';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase, type AppDatabase } from '../db';
import { systemSettings } from '../db/schema';
import type { DataPaths } from './backup.interfaces';
import {
	appVersion,
	checkArchive,
	createBackup,
	readArchiveManifest,
	restoreBackup
} from './backup';
import { instanceRunning, markInstanceRunning } from './instance';

const MEDIA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

let root: string;

let source: DataPaths;

let db: AppDatabase;

function pathsIn(directory: string): DataPaths {
	return {
		dataDir: directory,
		databasePath: join(directory, 'servitor.db'),
		uploadsDir: join(directory, 'uploads'),
		backupsDir: join(directory, 'backups')
	};
}

beforeEach(() => {
	root = resolve('.tmp', 'tests', `operations-${crypto.randomUUID()}`);
	source = pathsIn(join(root, 'source'));
	mkdirSync(join(source.uploadsDir, MEDIA_ID), { recursive: true });
	writeFileSync(join(source.uploadsDir, MEDIA_ID, '480.webp'), 'image-bytes');
	mkdirSync(join(source.uploadsDir, '.staging-unfinished'), { recursive: true });
	db = openDatabase(source.databasePath);
	migrateDatabase(db, MIGRATIONS_FOLDER);
	db.update(systemSettings).set({ siteName: 'Backed up' }).where(eq(systemSettings.id, 1)).run();
});

afterEach(() => {
	db.$client.close();
	rmSync(root, { recursive: true, force: true });
});

async function entries(archive: string): Promise<string[]> {
	const names: string[] = [];

	await list({ file: archive, onReadEntry: (entry) => names.push(entry.path) });

	return names.sort();
}

function tarEntry(name: string, content: string): Buffer {
	const header = Buffer.alloc(512);
	const body = Buffer.from(content);

	header.write(name, 0, 100, 'utf8');
	header.write('0000644\0', 100, 'ascii');
	header.write('0000000\0', 108, 'ascii');
	header.write('0000000\0', 116, 'ascii');
	header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
	header.write('00000000000\0', 136, 'ascii');
	header.write('        ', 148, 'ascii');
	header.write('0', 156, 'ascii');
	header.write('ustar\u000000', 257, 'ascii');

	let checksum = 0;

	for (const byte of header) {
		checksum += byte;
	}

	header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');

	const padding = Buffer.alloc((512 - (body.length % 512)) % 512);

	return Buffer.concat([header, body, padding]);
}

function rawArchive(name: string, files: [string, string][]): string {
	const path = join(root, name);

	writeFileSync(
		path,
		gzipSync(
			Buffer.concat([
				...files.map(([entry, content]) => tarEntry(entry, content)),
				Buffer.alloc(1024)
			])
		)
	);

	return path;
}

describe('backups', () => {
	it('writes a timestamped archive with the database, a manifest and the uploads', async () => {
		const archive = await createBackup(db, source, {
			now: new Date('2026-09-24T12:30:00.000Z')
		});

		expect(archive).toBe(
			join(source.backupsDir, 'servitor-backup-2026-09-24T12-30-00Z.tar.gz')
		);
		expect(await entries(archive)).toEqual([
			'backup.json',
			'servitor.db',
			'uploads/',
			`uploads/${MEDIA_ID}/`,
			`uploads/${MEDIA_ID}/480.webp`
		]);
	});

	it('restores the database and the uploads and keeps the replaced data', async () => {
		const archive = await createBackup(db, source);
		const target = pathsIn(join(root, 'target'));

		mkdirSync(target.uploadsDir, { recursive: true });
		writeFileSync(target.databasePath, 'old database');
		writeFileSync(join(target.uploadsDir, 'old.txt'), 'old upload');

		const result = await restoreBackup(target, archive, false);

		expect(result.status).toBe('restored');

		const restored = new Database(target.databasePath, { readonly: true });

		expect(restored.prepare('select site_name from system_settings').get()).toEqual({
			site_name: 'Backed up'
		});
		restored.close();
		expect(readFileSync(join(target.uploadsDir, MEDIA_ID, '480.webp'), 'utf8')).toBe(
			'image-bytes'
		);

		if (result.status === 'restored') {
			expect(readFileSync(join(result.previousDataDir, 'servitor.db'), 'utf8')).toBe(
				'old database'
			);
			expect(readFileSync(join(result.previousDataDir, 'uploads', 'old.txt'), 'utf8')).toBe(
				'old upload'
			);
		}
	});

	it('refuses to restore while the app is running unless forced', async () => {
		const archive = await createBackup(db, source);
		const target = pathsIn(join(root, 'running'));

		mkdirSync(target.dataDir, { recursive: true });

		const stop = markInstanceRunning(target.dataDir);

		try {
			expect(instanceRunning(target.dataDir)).toBe(true);
			expect(await restoreBackup(target, archive, false)).toEqual({ status: 'running' });
			expect((await restoreBackup(target, archive, true)).status).toBe('restored');
		} finally {
			stop();
		}

		expect(instanceRunning(target.dataDir)).toBe(false);
	});

	it.each([
		['has too many entries', { maxEntries: 2 }, 'more than 2 entries'],
		['is larger than the free space', { maxBytes: 10 }, 'free space']
	])('rejects an archive that %s before unpacking it', async (_name, limits, reason) => {
		const archive = await createBackup(db, source);
		const target = pathsIn(join(root, 'limited'));

		mkdirSync(target.dataDir, { recursive: true });
		writeFileSync(target.databasePath, 'current database');

		expect(await restoreBackup(target, archive, false, new Date(), limits)).toEqual({
			status: 'invalid_archive',
			reason: expect.stringContaining(reason)
		});
		expect(readFileSync(target.databasePath, 'utf8')).toBe('current database');
	});

	it.each([
		[
			'traversal',
			[
				['../evil.txt', 'x'],
				['backup.json', '{"format":1}'],
				['servitor.db', '']
			]
		],
		[
			'unexpected',
			[
				['evil.txt', 'x'],
				['backup.json', '{"format":1}'],
				['servitor.db', '']
			]
		],
		['incomplete', [['backup.json', '{"format":1}']]],
		[
			'corrupt',
			[
				['backup.json', '{"format":1}'],
				['servitor.db', 'not a database']
			]
		],
		[
			'unknown format',
			[
				['backup.json', '{"format":9}'],
				['servitor.db', '']
			]
		]
	])('rejects a %s archive without touching the data', async (name, files) => {
		const target = pathsIn(join(root, 'guarded'));

		mkdirSync(target.dataDir, { recursive: true });
		writeFileSync(target.databasePath, 'current database');

		const result = await restoreBackup(
			target,
			rawArchive(`${name}.tar.gz`, files as [string, string][]),
			false
		);

		expect(result.status).toBe('invalid_archive');
		expect(readFileSync(target.databasePath, 'utf8')).toBe('current database');
	});
});

function insertSession(target: Database.Database, token: string): void {
	const now = Date.now();

	target.pragma('foreign_keys = OFF');
	target
		.prepare(
			'insert into session (id, expires_at, token, created_at, updated_at, user_id) values (?, ?, ?, ?, ?, ?)'
		)
		.run(crypto.randomUUID(), now + 3_600_000, token, now, now, 'someone');
	target.pragma('foreign_keys = ON');
}

async function databaseOf(archive: string): Promise<string> {
	const into = join(root, `extracted-${crypto.randomUUID()}`);

	mkdirSync(into, { recursive: true });
	await extract({ file: archive, cwd: into, filter: (path) => path === 'servitor.db' });

	return join(into, 'servitor.db');
}

async function archiveWithDatabase(
	name: string,
	prepare: (database: Database.Database) => void
): Promise<string> {
	const directory = join(root, `crafted-${name}`);
	const archive = join(root, `${name}.tar.gz`);

	mkdirSync(directory, { recursive: true });
	await db.$client.backup(join(directory, 'servitor.db'));

	const database = new Database(join(directory, 'servitor.db'));

	prepare(database);
	database.pragma('journal_mode = DELETE');
	database.close();
	writeFileSync(
		join(directory, 'backup.json'),
		JSON.stringify({ format: 2, createdAt: new Date().toISOString() })
	);
	await create({ cwd: directory, file: archive, gzip: true, portable: true }, [
		'backup.json',
		'servitor.db'
	]);

	return archive;
}

async function olderArchive(): Promise<string> {
	const directory = join(root, 'older');
	const archive = join(root, 'older.tar.gz');
	const older = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).slice(0, -1);

	mkdirSync(directory, { recursive: true });

	const database = new Database(join(directory, 'servitor.db'));

	database.exec(
		'create table "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)'
	);

	for (const migration of older) {
		for (const statement of migration.sql) {
			if (statement.trim() !== '') {
				database.exec(statement);
			}
		}

		database
			.prepare('insert into "__drizzle_migrations" (hash, created_at) values (?, ?)')
			.run(migration.hash, migration.folderMillis);
	}

	database.close();
	writeFileSync(
		join(directory, 'backup.json'),
		JSON.stringify({ format: 1, createdAt: new Date().toISOString() })
	);
	await create({ cwd: directory, file: archive, gzip: true, portable: true }, [
		'backup.json',
		'servitor.db'
	]);

	return archive;
}

describe('backup contents', () => {
	it('records the app version and the source in the manifest', async () => {
		const manual = await createBackup(db, source, { source: 'panel' });
		const scheduled = await createBackup(db, source, {
			source: 'schedule',
			now: new Date('2026-09-24T03:00:00.000Z')
		});

		expect(await readArchiveManifest(manual)).toMatchObject({
			format: 2,
			appVersion: appVersion(),
			source: 'panel'
		});
		expect(scheduled).toBe(
			join(source.backupsDir, 'servitor-auto-2026-09-24T03-00-00Z.tar.gz')
		);
		expect(await readArchiveManifest(scheduled)).toMatchObject({ source: 'schedule' });
	});

	it('never overwrites an archive from the same second', async () => {
		const now = new Date('2026-09-24T12:30:00.000Z');
		const first = await createBackup(db, source, { now });
		const second = await createBackup(db, source, { now });

		expect(second).not.toBe(first);
		expect(second).toBe(
			join(source.backupsDir, 'servitor-backup-2026-09-24T12-30-00Z-1.tar.gz')
		);
	});

	it('leaves sessions and verification tokens out of the archive', async () => {
		insertSession(db.$client, 'secret-session-token');

		const archive = await createBackup(db, source);
		const copy = await databaseOf(archive);
		const database = new Database(copy, { readonly: true });

		expect(database.prepare('select count(*) as count from session').get()).toEqual({
			count: 0
		});
		database.close();
		expect(readFileSync(copy).includes('secret-session-token')).toBe(false);
	});

	it('reads no manifest from other files', async () => {
		const notAnArchive = join(root, 'plain.txt');

		writeFileSync(notAnArchive, 'plain text');

		expect(await readArchiveManifest(notAnArchive)).toBeNull();
		expect(await readArchiveManifest(join(root, 'missing.tar.gz'))).toBeNull();
	});
});

describe('restore checks', () => {
	it('accepts a backup of this version', async () => {
		const archive = await createBackup(db, source);

		expect(await checkArchive(archive, root)).toMatchObject({
			status: 'valid',
			manifest: { format: 2, source: 'cli' }
		});
	});

	it.each([
		{
			name: 'an extra trigger',
			reason: 'schema',
			prepare: (database: Database.Database) =>
				database.exec(
					"create trigger steal after insert on audit_log begin update system_settings set site_name = 'x'; end"
				)
		},
		{
			name: 'an extra table',
			reason: 'schema',
			prepare: (database: Database.Database) =>
				database.exec('create table extra (id integer)')
		},
		{
			name: 'a migration this version does not know',
			reason: 'newer',
			prepare: (database: Database.Database) => {
				database
					.prepare('insert into "__drizzle_migrations" (hash, created_at) values (?, ?)')
					.run('unknown', 9_999_999_999_999);
			}
		},
		{
			name: 'no migration history',
			reason: 'not created by Servitor',
			prepare: (database: Database.Database) =>
				database.exec('drop table "__drizzle_migrations"')
		}
	])('rejects a database with $name', async ({ name, reason, prepare }) => {
		const archive = await archiveWithDatabase(name.replaceAll(' ', '-'), prepare);
		const target = pathsIn(join(root, `guarded-${name.replaceAll(' ', '-')}`));

		mkdirSync(target.dataDir, { recursive: true });
		writeFileSync(target.databasePath, 'current database');

		expect(await checkArchive(archive, root)).toEqual({
			status: 'invalid_archive',
			reason: expect.stringContaining(reason)
		});
		expect(await restoreBackup(target, archive, false)).toEqual({
			status: 'invalid_archive',
			reason: expect.stringContaining(reason)
		});
		expect(readFileSync(target.databasePath, 'utf8')).toBe('current database');
	});

	it('restores a backup made before the latest migration', async () => {
		const target = pathsIn(join(root, 'older-target'));

		mkdirSync(target.dataDir, { recursive: true });

		expect((await restoreBackup(target, await olderArchive(), false)).status).toBe('restored');

		const restored = openDatabase(target.databasePath);

		migrateDatabase(restored, MIGRATIONS_FOLDER);
		expect(restored.select().from(systemSettings).get()).toBeDefined();
		restored.$client.close();
	});

	it('signs everybody out when it restores an archive with sessions', async () => {
		const archive = await archiveWithDatabase('with-sessions', (database) =>
			insertSession(database, 'old-session-token')
		);
		const target = pathsIn(join(root, 'sessions-target'));

		mkdirSync(target.dataDir, { recursive: true });

		expect((await restoreBackup(target, archive, false)).status).toBe('restored');

		const restored = new Database(target.databasePath, { readonly: true });

		expect(restored.prepare('select count(*) as count from session').get()).toEqual({
			count: 0
		});
		restored.close();
		copyFileSync(target.databasePath, join(root, 'restored-copy.db'));
		expect(readFileSync(join(root, 'restored-copy.db')).includes('old-session-token')).toBe(
			false
		);
	});
});
