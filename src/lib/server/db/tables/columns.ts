import { sql } from 'drizzle-orm';
import { integer, text } from 'drizzle-orm/sqlite-core';

const CURRENT_TIMESTAMP_MS = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export function uuidPrimaryKey() {
	return text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
}

export function timestamp(name: string) {
	return integer(name, { mode: 'timestamp_ms' });
}

export function flag(name: string) {
	return integer(name, { mode: 'boolean' });
}

export function createdAt() {
	return timestamp('created_at').notNull().default(CURRENT_TIMESTAMP_MS);
}

export function updatedAt() {
	return timestamp('updated_at')
		.notNull()
		.default(CURRENT_TIMESTAMP_MS)
		.$onUpdateFn(() => new Date());
}
