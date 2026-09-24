import { asc, count, eq } from 'drizzle-orm';
import { CORS_ORIGIN_MAX_LENGTH, MAX_CORS_ORIGINS } from '../../constants/api';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import type { DatabaseExecutor } from '../db';
import { corsOrigins, user } from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import type {
	CorsOriginAddResult,
	CorsOriginRemoveResult,
	CorsOriginView
} from './cors.interfaces';

export function normalizeOrigin(value: string): string | null {
	const trimmed = value.trim();

	if (trimmed === '' || trimmed.length > CORS_ORIGIN_MAX_LENGTH || trimmed.includes('*')) {
		return null;
	}

	let url: URL;

	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return null;
	}

	if (
		url.username !== '' ||
		url.password !== '' ||
		url.pathname !== '/' ||
		url.search !== '' ||
		url.hash !== '' ||
		trimmed.endsWith('?') ||
		trimmed.endsWith('#')
	) {
		return null;
	}

	return url.origin;
}

export function listCorsOrigins(db: DatabaseExecutor): CorsOriginView[] {
	return db
		.select({
			id: corsOrigins.id,
			origin: corsOrigins.origin,
			createdAt: corsOrigins.createdAt,
			createdByName: user.name
		})
		.from(corsOrigins)
		.innerJoin(user, eq(user.id, corsOrigins.createdBy))
		.orderBy(asc(corsOrigins.origin))
		.all();
}

export function isAllowedOrigin(db: DatabaseExecutor, header: string | null): string | null {
	if (header === null || header === 'null') {
		return null;
	}

	const origin = normalizeOrigin(header);

	if (origin === null || origin !== header.toLowerCase()) {
		return null;
	}

	const row = db
		.select({ origin: corsOrigins.origin })
		.from(corsOrigins)
		.where(eq(corsOrigins.origin, origin))
		.get();

	return row?.origin ?? null;
}

export function addCorsOrigin(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	value: string
): CorsOriginAddResult {
	requirePermission(actor, 'cors.manage', null);

	const origin = normalizeOrigin(value);

	if (origin === null) {
		return 'invalid_origin';
	}

	return runtime.db.transaction((tx): CorsOriginAddResult => {
		if (
			tx
				.select({ id: corsOrigins.id })
				.from(corsOrigins)
				.where(eq(corsOrigins.origin, origin))
				.get()
		) {
			return 'exists';
		}

		if (
			(tx.select({ total: count() }).from(corsOrigins).get()?.total ?? 0) >= MAX_CORS_ORIGINS
		) {
			return 'too_many';
		}

		const id = crypto.randomUUID();

		tx.insert(corsOrigins).values({ id, origin, createdBy: actor.id }).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'cors.origin_added',
			targetType: 'cors_origin',
			targetId: id,
			details: { origin },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'added';
	});
}

export function removeCorsOrigin(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string
): CorsOriginRemoveResult {
	requirePermission(actor, 'cors.manage', null);

	return runtime.db.transaction((tx): CorsOriginRemoveResult => {
		const row = tx
			.select({ origin: corsOrigins.origin })
			.from(corsOrigins)
			.where(eq(corsOrigins.id, id))
			.get();

		if (row === undefined) {
			return 'not_found';
		}

		tx.delete(corsOrigins).where(eq(corsOrigins.id, id)).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'cors.origin_removed',
			targetType: 'cors_origin',
			targetId: id,
			details: { origin: row.origin },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'removed';
	});
}
