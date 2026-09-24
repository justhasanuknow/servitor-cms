import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { AppDatabase } from '../db';
import { auditLog, user } from '../db/schema';
import type {
	AuditEntryRow,
	AuditEntryView,
	AuditFilters,
	AuditPage
} from './audit-query.interfaces';

export const AUDIT_PAGE_SIZE = 50;

export function queryAuditLog(db: AppDatabase, filters: AuditFilters): AuditPage {
	const condition = and(...conditionsFor(filters));
	const total = db.select({ total: count() }).from(auditLog).where(condition).get()?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
	const page = Math.min(filters.page, pageCount);
	const rows = db
		.select({
			id: auditLog.id,
			createdAt: auditLog.createdAt,
			actorType: auditLog.actorType,
			actorId: auditLog.actorId,
			actorName: user.name,
			actorEmail: user.email,
			action: auditLog.action,
			targetType: auditLog.targetType,
			targetId: auditLog.targetId,
			ip: auditLog.ip,
			userAgent: auditLog.userAgent,
			details: auditLog.details
		})
		.from(auditLog)
		.leftJoin(user, eq(user.id, auditLog.actorId))
		.where(condition)
		.orderBy(desc(auditLog.createdAt), desc(auditLog.id))
		.limit(AUDIT_PAGE_SIZE)
		.offset((page - 1) * AUDIT_PAGE_SIZE)
		.all();

	return {
		entries: rows.map(toEntryView),
		page,
		pageCount,
		total
	};
}

function conditionsFor(filters: AuditFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.actorId !== null) {
		conditions.push(eq(auditLog.actorId, filters.actorId));
	}

	if (filters.actorType !== null) {
		conditions.push(eq(auditLog.actorType, filters.actorType));
	}

	if (filters.action !== null) {
		conditions.push(eq(auditLog.action, filters.action));
	}

	if (filters.targetType !== null) {
		conditions.push(eq(auditLog.targetType, filters.targetType));
	}

	if (filters.targetId !== null) {
		conditions.push(eq(auditLog.targetId, filters.targetId));
	}

	if (filters.from !== null) {
		conditions.push(gte(auditLog.createdAt, filters.from));
	}

	if (filters.to !== null) {
		conditions.push(lt(auditLog.createdAt, filters.to));
	}

	return conditions;
}

function toEntryView(row: AuditEntryRow): AuditEntryView {
	let details: string | null = null;

	if (row.details !== null) {
		details = JSON.stringify(row.details, null, 2);
	}

	return { ...row, details };
}
