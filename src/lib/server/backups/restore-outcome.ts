import { recordAuditEntry } from '../audit/audit-log';
import type { RestoreOutcome } from '../operations/restore-request.interfaces';
import type { Runtime } from '../runtime.interfaces';

export function recordRestoreOutcome(runtime: Runtime, outcome: RestoreOutcome | null): void {
	if (outcome === null) {
		return;
	}

	if (outcome.status === 'restored') {
		runtime.logger.warn(
			{ archive: outcome.archive, previousData: outcome.previousDataDir },
			'A backup was restored'
		);
		recordAuditEntry(runtime.db, {
			actorType: 'system',
			action: 'backup.restored',
			targetType: 'backup',
			details: {
				archive: outcome.archive,
				requestedBy: outcome.requestedBy,
				previousData: outcome.previousDataDir
			}
		});

		return;
	}

	runtime.logger.error(
		{ archive: outcome.archive, reason: outcome.reason },
		'A requested restore failed; the data was not changed'
	);
	recordAuditEntry(runtime.db, {
		actorType: 'system',
		action: 'backup.restore_failed',
		targetType: 'backup',
		details: {
			archive: outcome.archive,
			requestedBy: outcome.requestedBy,
			reason: outcome.reason
		}
	});
}
