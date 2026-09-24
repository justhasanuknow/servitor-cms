import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AppDatabase } from '../db';
import { session } from '../db/schema';
import { summarizeUserAgent } from '../http/user-agent';
import type { Runtime } from '../runtime.interfaces';
import type { AuthSessionData, AuthUser } from './auth';
import type { AuthRequest } from './auth-request.interfaces';
import { reauthenticate } from './reauthentication';
import type { ReauthenticationInput } from './reauthentication.interfaces';
import type {
	OtherSessionsRevokeResult,
	SessionRevokeResult,
	SessionSummary
} from './sessions.interfaces';

export const ABSOLUTE_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export async function loadActiveSession(
	runtime: Runtime,
	request: AuthRequest,
	now: number = Date.now()
): Promise<AuthSessionData | null> {
	const current = await runtime.auth.api.getSession({ headers: request.headers });

	if (!current || current.user.deactivatedAt) {
		return null;
	}

	if (now - current.session.createdAt.getTime() < ABSOLUTE_SESSION_LIFETIME_MS) {
		return current;
	}

	runtime.db.transaction((tx) => {
		tx.delete(session).where(eq(session.id, current.session.id)).run();
		recordAuditEntry(tx, {
			actorType: 'system',
			action: 'auth.session_revoked',
			targetType: 'user',
			targetId: current.user.id,
			details: { scope: 'absolute_lifetime' },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return null;
}

export function listOwnSessions(
	db: AppDatabase,
	userId: string,
	currentSessionId: string
): SessionSummary[] {
	const rows = db
		.select({
			id: session.id,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt
		})
		.from(session)
		.where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
		.orderBy(desc(session.updatedAt))
		.all();

	return rows.map((row) => {
		const agent = summarizeUserAgent(row.userAgent);

		return {
			id: row.id,
			current: row.id === currentSessionId,
			browser: agent.browser,
			os: agent.os,
			ipAddress: row.ipAddress,
			createdAt: row.createdAt,
			lastActiveAt: row.updatedAt
		};
	});
}

export async function revokeOwnSession(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	currentSessionId: string,
	sessionId: string,
	confirmation: ReauthenticationInput
): Promise<SessionRevokeResult> {
	const verification = await reauthenticate(runtime, request, actor, confirmation);

	if (verification !== 'verified') {
		return verification;
	}

	return runtime.db.transaction((tx) => {
		const result = tx
			.delete(session)
			.where(
				and(
					eq(session.id, sessionId),
					eq(session.userId, actor.id),
					ne(session.id, currentSessionId)
				)
			)
			.run();

		if (result.changes === 0) {
			return 'not_found';
		}

		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'auth.session_revoked',
			targetType: 'session',
			targetId: sessionId,
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'revoked';
	});
}

export async function revokeOtherOwnSessions(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	currentSessionId: string,
	confirmation: ReauthenticationInput
): Promise<OtherSessionsRevokeResult> {
	const verification = await reauthenticate(runtime, request, actor, confirmation);

	if (verification !== 'verified') {
		return { status: verification };
	}

	const count = runtime.db.transaction((tx) => {
		const result = tx
			.delete(session)
			.where(and(eq(session.userId, actor.id), ne(session.id, currentSessionId)))
			.run();

		if (result.changes === 0) {
			return 0;
		}

		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'auth.session_revoked',
			targetType: 'user',
			targetId: actor.id,
			details: { scope: 'other_sessions', count: result.changes },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return result.changes;
	});

	return { status: 'revoked', count };
}

export async function signOut(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser
): Promise<void> {
	await runtime.auth.api.signOut({ headers: request.headers });

	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: actor.id,
		action: 'auth.logout',
		targetType: 'user',
		targetId: actor.id,
		ip: request.ip,
		userAgent: request.userAgent
	});
}
