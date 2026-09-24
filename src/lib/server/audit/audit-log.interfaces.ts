import type { AuditAction, AuditActorType } from '../../constants/audit';

export interface AuditEntry {
	actorType: AuditActorType;
	actorId?: string | null;
	action: AuditAction;
	targetType?: string | null;
	targetId?: string | null;
	details?: Record<string, unknown> | null;
	ip?: string | null;
	userAgent?: string | null;
}

export type AuditListener = (entry: AuditEntry) => void;
