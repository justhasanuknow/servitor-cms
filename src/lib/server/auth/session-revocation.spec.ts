import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, session } from '../db/schema';
import { createTestRuntime } from '../testing/runtime';
import { revokeSessionsFromCli } from './session-revocation';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(() => {
	harness = createTestRuntime();
});

afterEach(() => {
	harness.dispose();
});

function revocations() {
	return harness.runtime.db
		.select()
		.from(auditLog)
		.where(eq(auditLog.action, 'auth.session_revoked'))
		.all();
}

describe('revokeSessionsFromCli', () => {
	it('ends every session of one user and records it', async () => {
		const adaId = await harness.createUser({ email: 'ada@example.com', password: PASSWORD });

		await harness.createUser({ email: 'grace@example.com', password: PASSWORD });
		await harness.signIn('ada@example.com', PASSWORD);
		await harness.signIn('ada@example.com', PASSWORD);
		await harness.signIn('grace@example.com', PASSWORD);

		expect(revokeSessionsFromCli(harness.runtime.db, ' Ada@Example.com ')).toEqual({
			status: 'revoked',
			count: 2
		});
		expect(harness.runtime.db.select().from(session).all()).toHaveLength(1);
		expect(revocations()).toMatchObject([
			{ actorType: 'cli', targetId: adaId, details: { scope: 'user', count: 2 } }
		]);
	});

	it('ends the sessions of all users without an email address', async () => {
		await harness.createUser({ email: 'ada@example.com', password: PASSWORD });
		await harness.createUser({ email: 'grace@example.com', password: PASSWORD });
		await harness.signIn('ada@example.com', PASSWORD);
		await harness.signIn('grace@example.com', PASSWORD);

		expect(revokeSessionsFromCli(harness.runtime.db, null)).toEqual({
			status: 'revoked',
			count: 2
		});
		expect(harness.runtime.db.select().from(session).all()).toEqual([]);
		expect(revocations()).toMatchObject([
			{ actorType: 'cli', targetId: null, details: { scope: 'all_users', count: 2 } }
		]);
	});

	it('reports an unknown email address without changing anything', async () => {
		await harness.createUser({ email: 'ada@example.com', password: PASSWORD });
		await harness.signIn('ada@example.com', PASSWORD);

		expect(revokeSessionsFromCli(harness.runtime.db, 'nobody@example.com')).toEqual({
			status: 'unknown_user'
		});
		expect(harness.runtime.db.select().from(session).all()).toHaveLength(1);
	});
});
