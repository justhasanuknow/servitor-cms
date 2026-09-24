import type { Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { eq } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuditEntry } from '../audit/audit-log.interfaces';
import { user } from '../db/schema';
import { recipientLocale, sendEmailLater, siteName } from '../email/notifications';
import { scheduledBackupFailedEmail } from '../email/templates';
import { createBackup, dataPaths, freeBytes } from '../operations/backup';
import type { Runtime } from '../runtime.interfaces';
import { loadBackupSchedule } from './backup-schedule';
import { pruneScheduledArchives } from './backup-store';
import type { BackupJob, BackupJobsState, BackupJobStart } from './backups.interfaces';

const jobsByRuntime = new WeakMap<Runtime, BackupJobs>();

export function backupJobs(runtime: Runtime): BackupJobs {
	let jobs = jobsByRuntime.get(runtime);

	if (jobs === undefined) {
		jobs = new BackupJobs(runtime);
		jobsByRuntime.set(runtime, jobs);
	}

	return jobs;
}

async function treeSize(path: string): Promise<number> {
	let total = 0;
	let entries: Dirent[];

	try {
		entries = await readdir(path, { withFileTypes: true });
	} catch {
		return 0;
	}

	for (const entry of entries) {
		const child = join(path, entry.name);

		if (entry.isDirectory()) {
			total += await treeSize(child);
		} else if (entry.isFile()) {
			total += (await stat(child)).size;
		}
	}

	return total;
}

async function fileSize(path: string): Promise<number> {
	try {
		return (await stat(path)).size;
	} catch {
		return 0;
	}
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

export class BackupJobs {
	readonly #runtime: Runtime;

	#current: BackupJob | null = null;

	#last: BackupJob | null = null;

	#running: Promise<BackupJob> | null = null;

	constructor(runtime: Runtime) {
		this.#runtime = runtime;
	}

	state(): BackupJobsState {
		return { current: this.#current, last: this.#last };
	}

	start(source: BackupJob['source'], requestedBy: string | null): BackupJobStart {
		if (this.#current !== null) {
			return { status: 'busy' };
		}

		const job: BackupJob = {
			id: crypto.randomUUID(),
			source,
			requestedBy,
			status: 'running',
			startedAt: new Date(),
			finishedAt: null,
			archive: null,
			error: null
		};

		this.#current = job;
		this.#running = this.#run(job);

		return { status: 'started', job };
	}

	async settled(): Promise<BackupJob | null> {
		if (this.#running === null) {
			return this.#last;
		}

		return this.#running;
	}

	async #run(job: BackupJob): Promise<BackupJob> {
		try {
			await this.#ensureSpace();

			const archive = await createBackup(this.#runtime.db, dataPaths(this.#runtime.env), {
				source: job.source,
				now: job.startedAt
			});

			job.archive = basename(archive);
			job.status = 'succeeded';
			this.#recordSuccess(job, await fileSize(archive), await this.#prune(job));
		} catch (error) {
			job.status = 'failed';
			job.error = errorMessage(error);
			this.#recordFailure(job);
		} finally {
			job.finishedAt = new Date();
			this.#last = job;
			this.#current = null;
			this.#running = null;
		}

		return job;
	}

	async #ensureSpace(): Promise<void> {
		const paths = dataPaths(this.#runtime.env);
		const needed = (await fileSize(paths.databasePath)) + (await treeSize(paths.uploadsDir));

		if ((await freeBytes(paths.backupsDir)) < needed) {
			throw new Error('there is not enough free disk space for the backup');
		}
	}

	async #prune(job: BackupJob): Promise<string[]> {
		if (job.source !== 'schedule') {
			return [];
		}

		const { retention } = loadBackupSchedule(this.#runtime.db);

		return pruneScheduledArchives(dataPaths(this.#runtime.env), retention);
	}

	#recordSuccess(job: BackupJob, size: number, removed: string[]): void {
		this.#runtime.logger.info(
			{ archive: job.archive, source: job.source, size, removed },
			'Backup created'
		);
		recordAuditEntry(this.#runtime.db, {
			...this.#actor(job),
			action: 'backup.created',
			targetType: 'backup',
			details: { archive: job.archive, source: job.source, size, removed }
		});
	}

	#recordFailure(job: BackupJob): void {
		this.#runtime.logger.error({ source: job.source, error: job.error }, 'Backup failed');
		recordAuditEntry(this.#runtime.db, {
			...this.#actor(job),
			action: 'backup.failed',
			targetType: 'backup',
			details: { source: job.source, error: job.error }
		});

		if (job.source === 'schedule') {
			this.#notifyFounder(job);
		}
	}

	#actor(job: BackupJob): Pick<AuditEntry, 'actorType' | 'actorId'> {
		if (job.requestedBy === null) {
			return { actorType: 'system' };
		}

		return { actorType: 'user', actorId: job.requestedBy };
	}

	#notifyFounder(job: BackupJob): void {
		const founder = this.#runtime.db
			.select({ id: user.id, email: user.email })
			.from(user)
			.where(eq(user.role, 'founder'))
			.get();

		if (!founder) {
			return;
		}

		const locale = recipientLocale(this.#runtime.db, founder.id, 'en');

		sendEmailLater(
			this.#runtime,
			founder.email,
			scheduledBackupFailedEmail(locale, siteName(this.#runtime.db), job.error ?? '')
		);
	}
}
