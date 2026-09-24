import { and, asc, eq, sql } from 'drizzle-orm';
import type { ManagedRole, UserStatus } from '../../constants/users';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { reauthenticate } from '../auth/reauthentication';
import type { ProtectedActionInput } from '../auth/two-factor-settings.interfaces';
import type { AppDatabase } from '../db';
import { account, session, user, userProfiles } from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import { accountLink, issueUserToken } from './tokens';
import type {
	InviteInput,
	InviteResult,
	LinkResult,
	ManagedUser,
	ManagedUserRow,
	RoleChangeResult,
	UserUpdateResult
} from './user-management.interfaces';

const managedUserColumns = {
	id: user.id,
	name: user.name,
	email: user.email,
	role: user.role,
	canPublishDirectly: user.canPublishDirectly,
	twoFactorEnabled: user.twoFactorEnabled,
	deactivatedAt: user.deactivatedAt,
	createdAt: user.createdAt,
	hasPassword: sql<number>`${account.password} is not null`.mapWith(Boolean)
};

export function listManagedUsers(db: AppDatabase): ManagedUser[] {
	return db
		.select(managedUserColumns)
		.from(user)
		.leftJoin(account, credentialAccountOf())
		.orderBy(asc(user.createdAt), asc(user.email))
		.all()
		.map(toManagedUser);
}

export function findManagedUser(db: AppDatabase, userId: string): ManagedUser | null {
	const row = db
		.select(managedUserColumns)
		.from(user)
		.leftJoin(account, credentialAccountOf())
		.where(eq(user.id, userId))
		.get();

	if (!row) {
		return null;
	}

	return toManagedUser(row);
}

export function inviteUser(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: InviteInput
): InviteResult {
	requirePermission(actor, 'user.create', { role: input.role });

	const existing = runtime.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, input.email))
		.get();

	if (existing) {
		return { status: 'email_taken' };
	}

	const userId = crypto.randomUUID();
	const token = runtime.db.transaction((tx) => {
		tx.insert(user)
			.values({
				id: userId,
				name: input.name,
				email: input.email,
				role: input.role,
				canPublishDirectly: false,
				mustChangePassword: false
			})
			.run();
		tx.insert(userProfiles).values({ userId }).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'user.invited',
			targetType: 'user',
			targetId: userId,
			details: { role: input.role },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return issueUserToken(tx, { userId, type: 'invite', createdBy: actor.id });
	});

	return { status: 'invited', userId, link: accountLink(runtime.env.ORIGIN, 'invite', token) };
}

export function createInviteLink(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	userId: string
): LinkResult {
	const target = findManagedUser(runtime.db, userId);

	if (!target) {
		return { status: 'not_found' };
	}

	requirePermission(actor, 'user.create', { role: target.role });

	if (target.status !== 'invited') {
		return { status: 'not_applicable' };
	}

	const token = runtime.db.transaction((tx) => {
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'user.invite_link_created',
			targetType: 'user',
			targetId: target.id,
			ip: request.ip,
			userAgent: request.userAgent
		});

		return issueUserToken(tx, { userId: target.id, type: 'invite', createdBy: actor.id });
	});

	return { status: 'created', link: accountLink(runtime.env.ORIGIN, 'invite', token) };
}

export function createPasswordResetLink(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	userId: string
): LinkResult {
	const target = findManagedUser(runtime.db, userId);

	if (!target) {
		return { status: 'not_found' };
	}

	requirePermission(actor, 'user.create_password_reset_link', target);

	if (target.status !== 'active') {
		return { status: 'not_applicable' };
	}

	const token = runtime.db.transaction((tx) => {
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'user.password_reset_link_created',
			targetType: 'user',
			targetId: target.id,
			ip: request.ip,
			userAgent: request.userAgent
		});

		return issueUserToken(tx, {
			userId: target.id,
			type: 'password_reset',
			createdBy: actor.id
		});
	});

	return { status: 'created', link: accountLink(runtime.env.ORIGIN, 'reset-password', token) };
}

export function setUserActive(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	userId: string,
	active: boolean
): UserUpdateResult {
	const target = findManagedUser(runtime.db, userId);

	if (!target) {
		return 'not_found';
	}

	requirePermission(actor, 'user.set_active', target);

	if (active === (target.status !== 'deactivated')) {
		return 'unchanged';
	}

	runtime.db.transaction((tx) => {
		if (active) {
			tx.update(user)
				.set({ deactivatedAt: null, updatedAt: new Date() })
				.where(eq(user.id, target.id))
				.run();
		} else {
			tx.update(user)
				.set({ deactivatedAt: new Date(), updatedAt: new Date() })
				.where(eq(user.id, target.id))
				.run();
			tx.delete(session).where(eq(session.userId, target.id)).run();
		}

		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: activationAction(active),
			targetType: 'user',
			targetId: target.id,
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'updated';
}

export async function changeUserRole(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	userId: string,
	role: ManagedRole,
	confirmation: ProtectedActionInput
): Promise<RoleChangeResult> {
	const target = findManagedUser(runtime.db, userId);

	if (!target) {
		return 'not_found';
	}

	requirePermission(actor, 'user.change_role', target);

	if (target.role === role) {
		return 'unchanged';
	}

	const verification = await reauthenticate(runtime, request, actor, confirmation);

	if (verification !== 'verified') {
		return verification;
	}

	runtime.db.transaction((tx) => {
		tx.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, target.id)).run();
		tx.delete(session).where(eq(session.userId, target.id)).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'user.role_changed',
			targetType: 'user',
			targetId: target.id,
			details: { from: target.role, to: role },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'updated';
}

export function setPublishDirectly(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	userId: string,
	value: boolean
): UserUpdateResult {
	const target = findManagedUser(runtime.db, userId);

	if (!target) {
		return 'not_found';
	}

	requirePermission(actor, 'user.set_publish_directly', target);

	if (target.canPublishDirectly === value) {
		return 'unchanged';
	}

	runtime.db.transaction((tx) => {
		tx.update(user)
			.set({ canPublishDirectly: value, updatedAt: new Date() })
			.where(eq(user.id, target.id))
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'user.publish_permission_changed',
			targetType: 'user',
			targetId: target.id,
			details: { canPublishDirectly: value },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'updated';
}

function credentialAccountOf() {
	return and(eq(account.userId, user.id), eq(account.providerId, 'credential'));
}

function toManagedUser(row: ManagedUserRow): ManagedUser {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		canPublishDirectly: row.canPublishDirectly,
		twoFactorEnabled: row.twoFactorEnabled === true,
		status: statusOf(row.deactivatedAt, row.hasPassword),
		createdAt: row.createdAt
	};
}

function statusOf(deactivatedAt: Date | null, hasPassword: boolean): UserStatus {
	if (deactivatedAt !== null) {
		return 'deactivated';
	}

	if (!hasPassword) {
		return 'invited';
	}

	return 'active';
}

function activationAction(active: boolean): 'user.reactivated' | 'user.deactivated' {
	if (active) {
		return 'user.reactivated';
	}

	return 'user.deactivated';
}
