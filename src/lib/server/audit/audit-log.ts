import type { DatabaseExecutor } from '../db';
import { auditLog } from '../db/schema';
import type { AuditEntry } from './audit-log.interfaces';

export function recordAuditEntry(db: DatabaseExecutor, entry: AuditEntry): void {
	db.insert(auditLog)
		.values({
			actorType: entry.actorType,
			actorId: entry.actorId ?? null,
			action: entry.action,
			targetType: entry.targetType ?? null,
			targetId: entry.targetId ?? null,
			details: entry.details ?? null,
			ip: entry.ip ?? null,
			userAgent: entry.userAgent ?? null
		})
		.run();
}
