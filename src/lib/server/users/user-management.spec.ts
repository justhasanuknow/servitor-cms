import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, session, user, userTokens } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import { signInWithPassword } from '../auth/sign-in';
import { acceptInvite, completePasswordReset, describeAccountLink } from './account-links';
import {
	changeUserRole,
	createInviteLink,
	createPasswordResetLink,
	findManagedUser,
	inviteUser,
	listManagedUsers,
	setPublishDirectly,
	setUserActive
} from './user-management';

const PASSWORD = 'Kx7-quiet-harbor-19';

const NEW_PASSWORD = 'lantern-orchard-seventeen';

let harness: ReturnType<typeof createTestRuntime>;

let ids: { founder: string; admin: string; otherAdmin: string; author: string };

beforeEach(async () => {
	harness = createTestRuntime();
	ids = {
		founder: await harness.createUser({
			email: 'founder@example.com',
			password: PASSWORD,
			role: 'founder'
		}),
		admin: await harness.createUser({
			email: 'admin@example.com',
			password: PASSWORD,
			role: 'admin'
		}),
		otherAdmin: await harness.createUser({
			email: 'admin-2@example.com',
			password: PASSWORD,
			role: 'admin'
		}),
		author: await harness.createUser({
			email: 'author@example.com',
			password: PASSWORD,
			role: 'author'
		})
	};
});

afterEach(() => {
	harness.dispose();
});

function forbidden(run: () => unknown): void {
	expect(run).toThrow(expect.objectContaining({ status: 403 }));
}

function tokenOf(link: string): string {
	return link.slice(link.lastIndexOf('/') + 1);
}

function actions(): string[] {
	return harness.runtime.db
		.select({ action: auditLog.action })
		.from(auditLog)
		.all()
		.map((row) => row.action);
}

async function canSignIn(email: string, password: string, ip: string): Promise<boolean> {
	const result = await signInWithPassword(
		harness.runtime,
		harness.request(new TestCookieJar(), ip),
		{ email, password }
	);

	return result.status === 'signed_in';
}

describe('invitations', () => {
	it('lets the founder invite an admin who then sets a password', async () => {
		const { actor } = await harness.signIn('founder@example.com', PASSWORD);
		const result = inviteUser(harness.runtime, harness.request(new TestCookieJar()), actor, {
			email: 'new-admin@example.com',
			name: 'New Admin',
			role: 'admin'
		});

		if (result.status !== 'invited') {
			throw new Error('The invitation was not created');
		}

		expect(result.link).toMatch(/^http:\/\/localhost:4173\/panel\/invite\/[A-Za-z0-9_-]{43}$/);
		expect(findManagedUser(harness.runtime.db, result.userId)).toMatchObject({
			role: 'admin',
			status: 'invited'
		});
		expect(
			describeAccountLink(harness.runtime.db, 'invite', tokenOf(result.link))
		).toMatchObject({ email: 'new-admin@example.com' });
		expect(
			await acceptInvite(
				harness.runtime,
				harness.request(new TestCookieJar()),
				tokenOf(result.link),
				{
					password: 'short',
					confirmation: 'short'
				}
			)
		).toBe('too_short');
		expect(
			await acceptInvite(
				harness.runtime,
				harness.request(new TestCookieJar()),
				tokenOf(result.link),
				{
					password: NEW_PASSWORD,
					confirmation: NEW_PASSWORD
				}
			)
		).toBe('completed');
		expect(
			await acceptInvite(
				harness.runtime,
				harness.request(new TestCookieJar()),
				tokenOf(result.link),
				{
					password: NEW_PASSWORD,
					confirmation: NEW_PASSWORD
				}
			)
		).toBe('invalid_link');
		expect(await canSignIn('new-admin@example.com', NEW_PASSWORD, '192.0.2.10')).toBe(true);
		expect(actions()).toEqual(expect.arrayContaining(['user.invited', 'user.invite_accepted']));
	});

	it('limits admins to inviting authors', async () => {
		const { actor } = await harness.signIn('admin@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());

		forbidden(() =>
			inviteUser(harness.runtime, request, actor, {
				email: 'x@example.com',
				name: 'X',
				role: 'admin'
			})
		);
		expect(
			inviteUser(harness.runtime, request, actor, {
				email: 'writer@example.com',
				name: 'Writer',
				role: 'author'
			}).status
		).toBe('invited');
		expect(
			inviteUser(harness.runtime, request, actor, {
				email: 'author@example.com',
				name: 'Duplicate',
				role: 'author'
			})
		).toEqual({ status: 'email_taken' });
	});

	it('refuses invitations from authors', async () => {
		const { actor } = await harness.signIn('author@example.com', PASSWORD);

		forbidden(() =>
			inviteUser(harness.runtime, harness.request(new TestCookieJar()), actor, {
				email: 'friend@example.com',
				name: 'Friend',
				role: 'author'
			})
		);
	});

	it('replaces older invitation links and rejects expired ones', async () => {
		const { actor } = await harness.signIn('founder@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());
		const invited = inviteUser(harness.runtime, request, actor, {
			email: 'late@example.com',
			name: 'Late',
			role: 'author'
		});

		if (invited.status !== 'invited') {
			throw new Error('The invitation was not created');
		}

		const renewed = createInviteLink(harness.runtime, request, actor, invited.userId);

		if (renewed.status !== 'created') {
			throw new Error('The invitation link was not created');
		}

		expect(describeAccountLink(harness.runtime.db, 'invite', tokenOf(invited.link))).toBeNull();
		expect(
			describeAccountLink(harness.runtime.db, 'invite', tokenOf(renewed.link))
		).not.toBeNull();

		harness.runtime.db
			.update(userTokens)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(userTokens.userId, invited.userId))
			.run();

		expect(
			await acceptInvite(harness.runtime, request, tokenOf(renewed.link), {
				password: NEW_PASSWORD,
				confirmation: NEW_PASSWORD
			})
		).toBe('invalid_link');
		expect(createInviteLink(harness.runtime, request, actor, ids.author)).toEqual({
			status: 'not_applicable'
		});
	});
});

describe('activation', () => {
	it('lets an admin deactivate and reactivate an author', async () => {
		const { actor } = await harness.signIn('admin@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());

		await harness.signIn('author@example.com', PASSWORD);

		expect(setUserActive(harness.runtime, request, actor, ids.author, false)).toBe('updated');
		expect(
			harness.runtime.db.select().from(session).where(eq(session.userId, ids.author)).all()
		).toHaveLength(0);
		expect(await canSignIn('author@example.com', PASSWORD, '192.0.2.20')).toBe(false);
		expect(setUserActive(harness.runtime, request, actor, ids.author, false)).toBe('unchanged');
		expect(setUserActive(harness.runtime, request, actor, ids.author, true)).toBe('updated');
		expect(await canSignIn('author@example.com', PASSWORD, '192.0.2.21')).toBe(true);
		expect(actions()).toEqual(expect.arrayContaining(['user.deactivated', 'user.reactivated']));
	});

	it('keeps admins away from other admins, the founder and themselves', async () => {
		const { actor } = await harness.signIn('admin@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());

		forbidden(() => setUserActive(harness.runtime, request, actor, ids.otherAdmin, false));
		forbidden(() => setUserActive(harness.runtime, request, actor, ids.founder, false));
		forbidden(() => setUserActive(harness.runtime, request, actor, ids.admin, false));
	});

	it('lets the founder deactivate admins but not themselves', async () => {
		const { actor } = await harness.signIn('founder@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());

		expect(setUserActive(harness.runtime, request, actor, ids.admin, false)).toBe('updated');
		forbidden(() => setUserActive(harness.runtime, request, actor, ids.founder, false));
		expect(setUserActive(harness.runtime, request, actor, 'missing', false)).toBe('not_found');
	});
});

describe('role changes', () => {
	it('lets the founder promote an author after re-authentication', async () => {
		const founder = await harness.signIn('founder@example.com', PASSWORD);

		await harness.signIn('author@example.com', PASSWORD);

		expect(
			await changeUserRole(
				harness.runtime,
				harness.request(founder.jar, '192.0.2.30'),
				founder.actor,
				ids.author,
				'admin',
				{ password: 'not-the-password', totpCode: null }
			)
		).toBe('invalid_password');
		expect(findManagedUser(harness.runtime.db, ids.author)?.role).toBe('author');
		expect(
			await changeUserRole(
				harness.runtime,
				harness.request(founder.jar, '192.0.2.31'),
				founder.actor,
				ids.author,
				'admin',
				{ password: PASSWORD, totpCode: null }
			)
		).toBe('updated');
		expect(findManagedUser(harness.runtime.db, ids.author)?.role).toBe('admin');
		expect(
			harness.runtime.db.select().from(session).where(eq(session.userId, ids.author)).all()
		).toHaveLength(0);
		expect(
			harness.runtime.db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, 'user.role_changed'))
				.all()
		).toMatchObject([{ targetId: ids.author, details: { from: 'author', to: 'admin' } }]);
	});

	it('refuses role changes by admins', async () => {
		const admin = await harness.signIn('admin@example.com', PASSWORD);

		await expect(
			changeUserRole(
				harness.runtime,
				harness.request(admin.jar),
				admin.actor,
				ids.author,
				'admin',
				{ password: PASSWORD, totpCode: null }
			)
		).rejects.toMatchObject({ status: 403 });
	});
});

describe('direct publishing', () => {
	it('lets staff grant and revoke direct publishing for authors only', async () => {
		const { actor } = await harness.signIn('admin@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());

		expect(setPublishDirectly(harness.runtime, request, actor, ids.author, true)).toBe(
			'updated'
		);
		expect(findManagedUser(harness.runtime.db, ids.author)?.canPublishDirectly).toBe(true);
		expect(setPublishDirectly(harness.runtime, request, actor, ids.author, true)).toBe(
			'unchanged'
		);
		forbidden(() => setPublishDirectly(harness.runtime, request, actor, ids.otherAdmin, true));
		expect(actions()).toContain('user.publish_permission_changed');
	});
});

describe('password reset links', () => {
	it('resets the password once and signs the user out everywhere', async () => {
		const { actor } = await harness.signIn('admin@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());

		await harness.signIn('author@example.com', PASSWORD);

		const created = createPasswordResetLink(harness.runtime, request, actor, ids.author);

		if (created.status !== 'created') {
			throw new Error('The reset link was not created');
		}

		expect(created.link).toMatch(/\/panel\/reset-password\/[A-Za-z0-9_-]{43}$/);
		expect(
			await completePasswordReset(harness.runtime, request, tokenOf(created.link), {
				password: NEW_PASSWORD,
				confirmation: 'something-else-entirely'
			})
		).toBe('mismatch');
		expect(
			await completePasswordReset(harness.runtime, request, tokenOf(created.link), {
				password: NEW_PASSWORD,
				confirmation: NEW_PASSWORD
			})
		).toBe('completed');
		expect(
			await completePasswordReset(harness.runtime, request, tokenOf(created.link), {
				password: NEW_PASSWORD,
				confirmation: NEW_PASSWORD
			})
		).toBe('invalid_link');
		expect(
			harness.runtime.db.select().from(session).where(eq(session.userId, ids.author)).all()
		).toHaveLength(0);
		expect(await canSignIn('author@example.com', PASSWORD, '192.0.2.40')).toBe(false);
		expect(await canSignIn('author@example.com', NEW_PASSWORD, '192.0.2.41')).toBe(true);
		expect(actions()).toEqual(
			expect.arrayContaining(['user.password_reset_link_created', 'auth.password_reset'])
		);
	});

	it('limits reset links to the permission matrix', async () => {
		const admin = await harness.signIn('admin@example.com', PASSWORD);
		const founder = await harness.signIn('founder@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());

		forbidden(() =>
			createPasswordResetLink(harness.runtime, request, admin.actor, ids.otherAdmin)
		);
		forbidden(() =>
			createPasswordResetLink(harness.runtime, request, admin.actor, ids.founder)
		);
		expect(
			createPasswordResetLink(harness.runtime, request, founder.actor, ids.otherAdmin).status
		).toBe('created');
	});

	it('does not reset deactivated users', async () => {
		const { actor } = await harness.signIn('admin@example.com', PASSWORD);
		const request = harness.request(new TestCookieJar());
		const created = createPasswordResetLink(harness.runtime, request, actor, ids.author);

		if (created.status !== 'created') {
			throw new Error('The reset link was not created');
		}

		harness.runtime.db
			.update(user)
			.set({ deactivatedAt: new Date() })
			.where(eq(user.id, ids.author))
			.run();

		expect(
			await completePasswordReset(harness.runtime, request, tokenOf(created.link), {
				password: NEW_PASSWORD,
				confirmation: NEW_PASSWORD
			})
		).toBe('invalid_link');
		expect(createPasswordResetLink(harness.runtime, request, actor, ids.author)).toEqual({
			status: 'not_applicable'
		});
	});
});

describe('user list', () => {
	it('reports each user with a status', async () => {
		const { actor } = await harness.signIn('founder@example.com', PASSWORD);

		inviteUser(harness.runtime, harness.request(new TestCookieJar()), actor, {
			email: 'pending@example.com',
			name: 'Pending',
			role: 'author'
		});

		const users = listManagedUsers(harness.runtime.db);

		expect(users.map((entry) => [entry.email, entry.status])).toEqual([
			['founder@example.com', 'active'],
			['admin@example.com', 'active'],
			['admin-2@example.com', 'active'],
			['author@example.com', 'active'],
			['pending@example.com', 'invited']
		]);
	});
});
