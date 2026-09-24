import { eq } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { reauthenticate } from '../auth/reauthentication';
import type { ProtectedActionInput } from '../auth/two-factor-settings.interfaces';
import type { DatabaseExecutor } from '../db';
import { backupSchedule } from '../db/schema';
import type { Runtime } from '../runtime.interfaces';
import { requireBackupAccess } from './backup-access';
import type {
	BackupScheduleSettings,
	BackupScheduleView,
	ScheduleUpdateResult
} from './backups.interfaces';

export const BACKUP_HOUR_RANGE = { min: 0, max: 23 } as const;

export const BACKUP_RETENTION_RANGE = { min: 1, max: 365 } as const;

const HOUR_MS = 60 * 60 * 1000;

const DAY_MS = 24 * HOUR_MS;

const MONDAY = 1;

const DEFAULT_SCHEDULE: BackupScheduleSettings = { frequency: 'off', hour: 3, retention: 7 };

export function loadBackupSchedule(db: DatabaseExecutor): BackupScheduleView {
	const row = db.select().from(backupSchedule).where(eq(backupSchedule.id, 1)).get();

	if (!row) {
		return { ...DEFAULT_SCHEDULE, updatedAt: null };
	}

	return {
		frequency: row.frequency,
		hour: row.hour,
		retention: row.retention,
		updatedAt: row.updatedAt
	};
}

export async function updateBackupSchedule(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: BackupScheduleSettings,
	confirmation: ProtectedActionInput
): Promise<ScheduleUpdateResult> {
	if (!requireBackupAccess(actor)) {
		return 'two_factor_required';
	}

	const current = loadBackupSchedule(runtime.db);
	const changes = changedSettings(current, input);

	if (Object.keys(changes).length === 0) {
		return 'unchanged';
	}

	const verification = await reauthenticate(runtime, request, actor, confirmation);

	if (verification !== 'verified') {
		return verification;
	}

	const values = { ...input, updatedBy: actor.id, updatedAt: new Date() };

	runtime.db.transaction((tx) => {
		tx.insert(backupSchedule)
			.values({ id: 1, ...values })
			.onConflictDoUpdate({ target: backupSchedule.id, set: values })
			.run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'backup.schedule_updated',
			targetType: 'settings',
			details: { changes },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'updated';
}

function changedSettings(
	current: BackupScheduleSettings,
	next: BackupScheduleSettings
): Partial<BackupScheduleSettings> {
	const changes: Partial<BackupScheduleSettings> = {};

	if (current.frequency !== next.frequency) {
		changes.frequency = next.frequency;
	}

	if (current.hour !== next.hour) {
		changes.hour = next.hour;
	}

	if (current.retention !== next.retention) {
		changes.retention = next.retention;
	}

	return changes;
}

export function latestSlot(settings: BackupScheduleSettings, now: Date): Date | null {
	if (settings.frequency === 'off') {
		return null;
	}

	const slot = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), settings.hour)
	);

	if (slot.getTime() > now.getTime()) {
		slot.setTime(slot.getTime() - DAY_MS);
	}

	if (settings.frequency === 'weekly') {
		const daysSinceMonday = (slot.getUTCDay() - MONDAY + 7) % 7;

		slot.setTime(slot.getTime() - daysSinceMonday * DAY_MS);
	}

	return slot;
}

export function nextSlot(settings: BackupScheduleSettings, now: Date): Date | null {
	const latest = latestSlot(settings, now);

	if (latest === null) {
		return null;
	}

	if (settings.frequency === 'weekly') {
		return new Date(latest.getTime() + 7 * DAY_MS);
	}

	return new Date(latest.getTime() + DAY_MS);
}

export function scheduleIsDue(
	schedule: BackupScheduleView,
	newestScheduled: Date | null,
	now: Date
): boolean {
	const slot = latestSlot(schedule, now);

	if (slot === null) {
		return false;
	}

	const covered = [newestScheduled, schedule.updatedAt]
		.filter((time): time is Date => time !== null)
		.some((time) => time.getTime() >= slot.getTime());

	return !covered;
}
