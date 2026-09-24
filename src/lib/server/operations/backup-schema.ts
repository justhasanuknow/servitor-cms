import Database from 'better-sqlite3';
import { readMigrationFiles, type MigrationMeta } from 'drizzle-orm/migrator';

const MIGRATIONS_TABLE = '__drizzle_migrations';

const IGNORED_OBJECTS = new Set([
	MIGRATIONS_TABLE,
	'sqlite_sequence',
	'sqlite_stat1',
	'sqlite_stat4'
]);

interface AppliedMigration {
	hash: string;
	createdAt: number;
}

interface SchemaObject {
	type: string;
	name: string;
	tbl_name: string;
	sql: string | null;
}

export function databaseSchemaProblem(path: string, migrationsFolder: string): string | null {
	const database = new Database(path, { readonly: true, fileMustExist: true });

	try {
		database.pragma('trusted_schema = OFF');

		const applied = appliedMigrations(database);

		if (applied === null) {
			return 'the database was not created by Servitor CMS';
		}

		const known = readMigrationFiles({ migrationsFolder });
		const expected = expectedMigrations(applied, known);

		if (expected === null) {
			return 'the backup was created by a newer or different version of Servitor CMS';
		}

		if (!sameSchema(schemaOf(database), referenceSchema(expected))) {
			return 'the database schema does not match its migrations';
		}

		return null;
	} finally {
		database.close();
	}
}

function appliedMigrations(database: Database.Database): AppliedMigration[] | null {
	const table = database
		.prepare("select name from sqlite_master where type = 'table' and name = ?")
		.get(MIGRATIONS_TABLE);

	if (table === undefined) {
		return null;
	}

	return database
		.prepare(
			`select hash, created_at as createdAt from "${MIGRATIONS_TABLE}" order by created_at`
		)
		.all()
		.map((row) => readAppliedMigration(row));
}

function readAppliedMigration(row: unknown): AppliedMigration {
	if (
		typeof row !== 'object' ||
		row === null ||
		!('hash' in row) ||
		!('createdAt' in row) ||
		typeof row.hash !== 'string'
	) {
		return { hash: '', createdAt: Number.NaN };
	}

	return { hash: row.hash, createdAt: Number(row.createdAt) };
}

function expectedMigrations(
	applied: AppliedMigration[],
	known: MigrationMeta[]
): MigrationMeta[] | null {
	if (applied.length === 0 || applied.length > known.length) {
		return null;
	}

	const prefix = known.slice(0, applied.length);
	const matches = prefix.every(
		(migration, index) =>
			migration.folderMillis === applied[index].createdAt &&
			migration.hash === applied[index].hash
	);

	if (!matches) {
		return null;
	}

	return prefix;
}

function referenceSchema(migrations: MigrationMeta[]): SchemaObject[] {
	const reference = new Database(':memory:');

	try {
		for (const migration of migrations) {
			for (const statement of migration.sql) {
				if (statement.trim() !== '') {
					reference.exec(statement);
				}
			}
		}

		return schemaOf(reference);
	} finally {
		reference.close();
	}
}

function schemaOf(database: Database.Database): SchemaObject[] {
	return database
		.prepare('select type, name, tbl_name, sql from sqlite_master order by type, name')
		.all()
		.map((row) => readSchemaObject(row))
		.filter(
			(object) => !IGNORED_OBJECTS.has(object.name) && !IGNORED_OBJECTS.has(object.tbl_name)
		);
}

function readSchemaObject(row: unknown): SchemaObject {
	if (typeof row !== 'object' || row === null) {
		return { type: '', name: '', tbl_name: '', sql: null };
	}

	return {
		type: stringField(row, 'type'),
		name: stringField(row, 'name'),
		tbl_name: stringField(row, 'tbl_name'),
		sql: nullableStringField(row, 'sql')
	};
}

function stringField(row: object, key: string): string {
	const value: unknown = Reflect.get(row, key);

	if (typeof value === 'string') {
		return value;
	}

	return '';
}

function nullableStringField(row: object, key: string): string | null {
	const value: unknown = Reflect.get(row, key);

	if (typeof value === 'string') {
		return value;
	}

	return null;
}

function sameSchema(actual: SchemaObject[], expected: SchemaObject[]): boolean {
	return JSON.stringify(actual) === JSON.stringify(expected);
}
