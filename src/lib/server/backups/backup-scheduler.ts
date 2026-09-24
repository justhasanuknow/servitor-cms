import { dataPaths } from '../operations/backup';
import type { Runtime } from '../runtime.interfaces';
import { backupJobs } from './backup-jobs';
import { loadBackupSchedule, scheduleIsDue } from './backup-schedule';
import { newestScheduledArchive } from './backup-store';
import { removeStaleUploads } from './backup-uploads';

const TICK_MS = 60_000;

const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

let stopActive: (() => void) | null = null;

export async function runScheduledBackup(
	runtime: Runtime,
	now: Date,
	lastFailure: Date | null
): Promise<'started' | 'idle'> {
	const paths = dataPaths(runtime.env);

	await removeStaleUploads(paths, now);

	if (lastFailure !== null && now.getTime() - lastFailure.getTime() < RETRY_AFTER_FAILURE_MS) {
		return 'idle';
	}

	const schedule = loadBackupSchedule(runtime.db);

	if (!scheduleIsDue(schedule, await newestScheduledArchive(paths), now)) {
		return 'idle';
	}

	if (backupJobs(runtime).start('schedule', null).status !== 'started') {
		return 'idle';
	}

	return 'started';
}

export function startBackupScheduler(runtime: Runtime): () => void {
	stopActive?.();

	let lastFailure: Date | null = null;
	let ticking = false;

	const tick = async () => {
		if (ticking) {
			return;
		}

		ticking = true;

		try {
			if ((await runScheduledBackup(runtime, new Date(), lastFailure)) === 'started') {
				const job = await backupJobs(runtime).settled();

				if (job?.status === 'failed') {
					lastFailure = new Date();
				} else {
					lastFailure = null;
				}
			}
		} catch (error) {
			runtime.logger.error({ err: error }, 'The backup scheduler failed');
		} finally {
			ticking = false;
		}
	};
	const timer = setInterval(() => void tick(), TICK_MS);

	timer.unref();
	void tick();
	stopActive = () => {
		clearInterval(timer);
		stopActive = null;
	};

	return stopActive;
}
