import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase } from '../db';

const TEST_DATA_ROOT = resolve('.tmp', 'tests');

export function createTestDatabase() {
	mkdirSync(TEST_DATA_ROOT, { recursive: true });

	const directory = mkdtempSync(join(TEST_DATA_ROOT, 'db-'));
	const path = join(directory, 'test.db');
	const db = openDatabase(path);

	migrateDatabase(db, MIGRATIONS_FOLDER);

	return {
		db,
		path,
		dispose(): void {
			db.$client.close();
			rmSync(directory, { recursive: true, force: true });
		}
	};
}
