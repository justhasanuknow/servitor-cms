import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, user } from '../db/schema';
import { createTestDatabase } from '../testing/database';
import { AUDIT_PAGE_SIZE, queryAuditLog } from './audit-query';
import type { AuditFilters } from './audit-query.interfaces';

let database: ReturnType<typeof createTestDatabase>;

const NO_FILTERS: AuditFilters = {
	actorId: null,
	actorType: null,
	action: null,
	targetType: null,
	targetId: null,
	from: null,
	to: null,
	page: 1
};

beforeEach(() => {
	database = createTestDatabase();
	database.db
		.insert(user)
		.values({ id: 'user-1', name: 'Ada', email: 'ada@example.com', role: 'admin' })
		.run();
	database.db
		.insert(auditLog)
		.values([
			{
				actorType: 'user',
				actorId: 'user-1',
				action: 'user.invited',
				targetType: 'user',
				targetId: 'user-2',
				details: { role: 'author' },
				createdAt: new Date('2026-01-10T10:00:00Z')
			},
			{
				actorType: 'anonymous',
				action: 'auth.login_failed',
				ip: '198.51.100.1',
				createdAt: new Date('2026-02-10T10:00:00Z')
			},
			{
				actorType: 'cli',
				action: 'auth.founder_reset',
				targetType: 'user',
				targetId: 'user-1',
				createdAt: new Date('2026-03-10T10:00:00Z')
			}
		])
		.run();
});

afterEach(() => {
	database.dispose();
});

describe('queryAuditLog', () => {
	it('returns the newest entries first with the actor details', () => {
		const result = queryAuditLog(database.db, NO_FILTERS);

		expect(result.total).toBe(3);
		expect(result.entries.map((entry) => entry.action)).toEqual([
			'auth.founder_reset',
			'auth.login_failed',
			'user.invited'
		]);
		expect(result.entries[2]).toMatchObject({
			actorName: 'Ada',
			actorEmail: 'ada@example.com',
			details: JSON.stringify({ role: 'author' }, null, 2)
		});
	});

	it('filters by actor, action, target and date range', () => {
		const byActor = queryAuditLog(database.db, { ...NO_FILTERS, actorId: 'user-1' });
		const byType = queryAuditLog(database.db, { ...NO_FILTERS, actorType: 'anonymous' });
		const byAction = queryAuditLog(database.db, {
			...NO_FILTERS,
			action: 'auth.founder_reset'
		});
		const byTarget = queryAuditLog(database.db, {
			...NO_FILTERS,
			targetType: 'user',
			targetId: 'user-2'
		});
		const byDate = queryAuditLog(database.db, {
			...NO_FILTERS,
			from: new Date('2026-02-01T00:00:00Z'),
			to: new Date('2026-03-01T00:00:00Z')
		});

		expect(byActor.entries.map((entry) => entry.action)).toEqual(['user.invited']);
		expect(byType.entries.map((entry) => entry.action)).toEqual(['auth.login_failed']);
		expect(byAction.total).toBe(1);
		expect(byTarget.entries.map((entry) => entry.action)).toEqual(['user.invited']);
		expect(byDate.entries.map((entry) => entry.action)).toEqual(['auth.login_failed']);
	});

	it('pages through large result sets', () => {
		database.db
			.insert(auditLog)
			.values(
				Array.from({ length: AUDIT_PAGE_SIZE }, (_, index) => ({
					actorType: 'system' as const,
					action: 'user.created',
					createdAt: new Date(Date.UTC(2025, 0, 1, 0, index))
				}))
			)
			.run();

		const first = queryAuditLog(database.db, NO_FILTERS);
		const second = queryAuditLog(database.db, { ...NO_FILTERS, page: 2 });
		const beyond = queryAuditLog(database.db, { ...NO_FILTERS, page: 9 });

		expect(first.pageCount).toBe(2);
		expect(first.entries).toHaveLength(AUDIT_PAGE_SIZE);
		expect(second.entries).toHaveLength(3);
		expect(beyond.page).toBe(2);
	});
});
