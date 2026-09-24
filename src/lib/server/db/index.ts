import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function openDatabase(path: string) {
	mkdirSync(dirname(path), { recursive: true });

	return drizzle(new Database(path), { schema });
}

export type AppDatabase = ReturnType<typeof openDatabase>;
