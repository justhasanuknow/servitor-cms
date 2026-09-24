import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AppDatabase } from '../db';
import { session } from '../db/schema';
import { summarizeUserAgent } from '../http/user-agent';
import type { Runtime } from '../runtime.interfaces';
import type { AuthUser } from './auth';
import type { AuthRequest } from './auth-request.interfaces';
import type { SessionSummary } from './sessions.interfaces';

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

export function revokeOwnSession(
	db: AppDatabase,
	request: AuthRequest,
	actor: AuthUser,
	currentSessionId: string,
	sessionId: string
): boolean {
	return db.transaction((tx) => {
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
			return false;
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

		return true;
	});
}

export function revokeOtherOwnSessions(
	db: AppDatabase,
	request: AuthRequest,
	actor: AuthUser,
	currentSessionId: string
): number {
	return db.transaction((tx) => {
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
