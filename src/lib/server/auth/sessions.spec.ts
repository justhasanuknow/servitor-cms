import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, session } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import { listOwnSessions, revokeOtherOwnSessions, revokeOwnSession, signOut } from './sessions';
import { signInWithPassword } from './sign-in';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(() => {
	harness = createTestRuntime();
});

afterEach(() => {
	harness.dispose();
});

async function signedInJar(email: string, ip: string): Promise<TestCookieJar> {
	const jar = new TestCookieJar();
	const result = await signInWithPassword(harness.runtime, harness.request(jar, ip), {
		email,
		password: PASSWORD
	});

	expect(result).toEqual({ status: 'signed_in' });

	return jar;
}

describe('own sessions', () => {
	it('lists only the active sessions of the user and marks the current one', async () => {
		const userId = await harness.createUser({ email: 'ada@example.com', password: PASSWORD });

		await harness.createUser({ email: 'grace@example.com', password: PASSWORD });
		await signedInJar('ada@example.com', '198.51.100.1');
		await signedInJar('grace@example.com', '198.51.100.2');

		const jar = await signedInJar('ada@example.com', '198.51.100.3');
		const current = await harness.currentSession(jar);
		const sessions = listOwnSessions(harness.runtime.db, userId, current.session.id);

		expect(sessions).toHaveLength(2);
		expect(sessions.filter((entry) => entry.current)).toMatchObject([
			{ id: current.session.id, browser: 'Chrome', os: 'Windows' }
		]);
	});

	it('revokes one of its own sessions but never the current or a foreign one', async () => {
		const userId = await harness.createUser({ email: 'ada@example.com', password: PASSWORD });

		await harness.createUser({ email: 'grace@example.com', password: PASSWORD });

		const other = await signedInJar('ada@example.com', '198.51.100.1');
		const foreign = await signedInJar('grace@example.com', '198.51.100.2');
		const jar = await signedInJar('ada@example.com', '198.51.100.3');
		const current = await harness.currentSession(jar);
		const otherSession = await harness.currentSession(other);
		const foreignSession = await harness.currentSession(foreign);
		const request = harness.request(jar);

		expect(
			revokeOwnSession(
				harness.runtime.db,
				request,
				current.user,
				current.session.id,
				foreignSession.session.id
			)
		).toBe(false);
		expect(
			revokeOwnSession(
				harness.runtime.db,
				request,
				current.user,
				current.session.id,
				current.session.id
			)
		).toBe(false);
		expect(
			revokeOwnSession(
				harness.runtime.db,
				request,
				current.user,
				current.session.id,
				otherSession.session.id
			)
		).toBe(true);
		expect(listOwnSessions(harness.runtime.db, userId, current.session.id)).toHaveLength(1);
		expect(await harness.currentSession(foreign)).toBeDefined();
		expect(
			harness.runtime.db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, 'auth.session_revoked'))
				.all()
		).toMatchObject([
			{ actorId: userId, targetType: 'session', targetId: otherSession.session.id }
		]);
	});

	it('revokes every other session of the user', async () => {
		const userId = await harness.createUser({ email: 'ada@example.com', password: PASSWORD });

		await signedInJar('ada@example.com', '198.51.100.1');
		await signedInJar('ada@example.com', '198.51.100.2');

		const jar = await signedInJar('ada@example.com', '198.51.100.3');
		const current = await harness.currentSession(jar);

		expect(
			revokeOtherOwnSessions(
				harness.runtime.db,
				harness.request(jar),
				current.user,
				current.session.id
			)
		).toBe(2);
		expect(listOwnSessions(harness.runtime.db, userId, current.session.id)).toMatchObject([
			{ id: current.session.id, current: true }
		]);
	});

	it('signs out the current session', async () => {
		await harness.createUser({ email: 'ada@example.com', password: PASSWORD });

		const jar = await signedInJar('ada@example.com', '198.51.100.1');
		const current = await harness.currentSession(jar);

		await signOut(harness.runtime, harness.request(jar), current.user);

		expect(harness.runtime.db.select().from(session).all()).toHaveLength(0);
		expect(
			await harness.runtime.auth.api.getSession({ headers: harness.request(jar).headers })
		).toBeNull();
		expect(
			harness.runtime.db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, 'auth.logout'))
				.all()
		).toHaveLength(1);
	});
});
