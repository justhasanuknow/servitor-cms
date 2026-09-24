import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database, { type RunResult } from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

const BUSY_TIMEOUT_MS = 5000;

export const MIGRATIONS_FOLDER = resolve('drizzle');

function createDatabase(path: string) {
	return drizzle(new Database(path, { timeout: BUSY_TIMEOUT_MS }), { schema });
}

export type AppDatabase = ReturnType<typeof createDatabase>;

export type DatabaseExecutor = BaseSQLiteDatabase<'sync', RunResult, typeof schema>;

export function openDatabase(path: string): AppDatabase {
	mkdirSync(dirname(path), { recursive: true });

	const db = createDatabase(path);

	applyPragmas(db);

	return db;
}

export function migrateDatabase(db: AppDatabase, migrationsFolder: string): void {
	migrate(db, { migrationsFolder });
}

function applyPragmas(db: AppDatabase): void {
	const journal = db.get<{ journal_mode: string }>(sql`PRAGMA journal_mode = WAL`);

	if (journal.journal_mode !== 'wal') {
		throw new Error(`SQLite did not switch to WAL mode (got ${journal.journal_mode})`);
	}

	db.run(sql`PRAGMA synchronous = NORMAL`);
	db.run(sql`PRAGMA foreign_keys = ON`);
}
