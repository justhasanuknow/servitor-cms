import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog } from '../db/schema';
import { createTestDatabase } from '../testing/database';
import { onAuditEntry, recordAuditEntry } from './audit-log';
import type { AuditEntry } from './audit-log.interfaces';

let database: ReturnType<typeof createTestDatabase>;

beforeEach(() => {
	database = createTestDatabase();
});

afterEach(() => {
	database.dispose();
});

describe('recordAuditEntry', () => {
	it('stores every entry and passes it to listeners for the log stream', () => {
		const entries: AuditEntry[] = [];
		const stop = onAuditEntry((entry) => entries.push(entry));

		recordAuditEntry(database.db, { actorType: 'system', action: 'settings.updated' });
		stop();
		recordAuditEntry(database.db, { actorType: 'cli', action: 'auth.founder_reset' });

		expect(entries).toEqual([{ actorType: 'system', action: 'settings.updated' }]);
		expect(database.db.select().from(auditLog).all()).toHaveLength(2);
	});
});
