import type { DatabaseExecutor } from '../db';
import { auditLog } from '../db/schema';
import type { AuditEntry, AuditListener } from './audit-log.interfaces';

const listeners = new Set<AuditListener>();

export function onAuditEntry(listener: AuditListener): () => void {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

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

	for (const listener of listeners) {
		listener(entry);
	}
}
