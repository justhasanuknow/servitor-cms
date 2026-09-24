import type { AuditActorType } from '../../constants/audit';

export interface AuditFilters {
	actorId: string | null;
	actorType: AuditActorType | null;
	action: string | null;
	targetType: string | null;
	targetId: string | null;
	from: Date | null;
	to: Date | null;
	page: number;
}

export interface AuditEntryView {
	id: string;
	createdAt: Date;
	actorType: AuditActorType;
	actorId: string | null;
	actorName: string | null;
	actorEmail: string | null;
	action: string;
	targetType: string | null;
	targetId: string | null;
	ip: string | null;
	userAgent: string | null;
	details: string | null;
}

export interface AuditEntryRow extends Omit<AuditEntryView, 'details'> {
	details: Record<string, unknown> | null;
}

export interface AuditPage {
	entries: AuditEntryView[];
	page: number;
	pageCount: number;
	total: number;
}
