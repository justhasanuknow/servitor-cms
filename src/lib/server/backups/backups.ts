import { stat } from 'node:fs/promises';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { reauthenticate } from '../auth/reauthentication';
import type { ProtectedActionInput } from '../auth/two-factor-settings.interfaces';
import { recipientLocale, sendEmailLater, siteName } from '../email/notifications';
import { backupDownloadedEmail } from '../email/templates';
import { checkArchive, dataPaths } from '../operations/backup';
import { passphraseProblem } from '../operations/backup-crypto';
import {
	hasPendingRestore,
	readRestoreOutcome,
	requestRestore,
	restoreProblem
} from '../operations/restore-request';
import type { Runtime } from '../runtime.interfaces';
import { requireBackupAccess } from './backup-access';
import { backupJobs } from './backup-jobs';
import { loadBackupSchedule, nextSlot } from './backup-schedule';
import { archivePath, deleteArchive, listArchives, storageSummary } from './backup-store';
import type {
	ArchiveEntry,
	BackupsOverview,
	DeleteResult,
	DownloadAuthorization,
	DownloadInput,
	ManualBackupResult,
	RestoreRequestResult
} from './backups.interfaces';

export async function backupsOverview(runtime: Runtime, actor: AuthUser): Promise<BackupsOverview> {
	const allowed = requireBackupAccess(actor);
	const paths = dataPaths(runtime.env);
	const schedule = loadBackupSchedule(runtime.db);

	return {
		allowed,
		archives: await listArchives(paths),
		storage: await storageSummary(paths),
		jobs: backupJobs(runtime).state(),
		schedule,
		nextScheduled: nextSlot(schedule, new Date()),
		lastRestore: await readRestoreOutcome(paths),
		restorePending: await hasPendingRestore(paths)
	};
}

export async function findArchive(
	runtime: Runtime,
	actor: AuthUser,
	name: string
): Promise<ArchiveEntry | null> {
	requireBackupAccess(actor);

	const archives = await listArchives(dataPaths(runtime.env));

	return archives.find((archive) => archive.name === name) ?? null;
}

export function startManualBackup(runtime: Runtime, actor: AuthUser): ManualBackupResult {
	if (!requireBackupAccess(actor)) {
		return 'two_factor_required';
	}

	return backupJobs(runtime).start('panel', actor.id).status;
}

async function existingArchive(runtime: Runtime, name: string): Promise<string | null> {
	const path = archivePath(dataPaths(runtime.env), name);

	if (path === null) {
		return null;
	}

	try {
		if ((await stat(path)).isFile()) {
			return path;
		}
	} catch {
		return null;
	}

	return null;
}

export async function authorizeDownload(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	name: string,
	input: DownloadInput
): Promise<DownloadAuthorization> {
	if (!requireBackupAccess(actor)) {
		return { status: 'two_factor_required' };
	}

	const path = await existingArchive(runtime, name);

	if (path === null) {
		return { status: 'not_found' };
	}

	let passphrase: string | null = null;

	if (input.passphrase !== '') {
		if (input.passphrase !== input.passphraseConfirmation) {
			return { status: 'passphrase_mismatch' };
		}

		const problem = passphraseProblem(input.passphrase);

		if (problem !== null) {
			return { status: `passphrase_${problem}` };
		}

		passphrase = input.passphrase;
	}

	const verification = await reauthenticate(runtime, request, actor, input.confirmation);

	if (verification !== 'verified') {
		return { status: verification };
	}

	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: actor.id,
		action: 'backup.downloaded',
		targetType: 'backup',
		details: { archive: name, encrypted: passphrase !== null },
		ip: request.ip,
		userAgent: request.userAgent
	});
	sendEmailLater(
		runtime,
		actor.email,
		backupDownloadedEmail(recipientLocale(runtime.db, actor.id, 'en'), siteName(runtime.db), {
			archive: name,
			ip: request.ip ?? '-',
			time: new Date().toISOString()
		})
	);

	return { status: 'authorized', path, name, passphrase };
}

export async function deleteBackupArchive(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	name: string,
	confirmation: ProtectedActionInput
): Promise<DeleteResult> {
	if (!requireBackupAccess(actor)) {
		return 'two_factor_required';
	}

	if ((await existingArchive(runtime, name)) === null) {
		return 'not_found';
	}

	const verification = await reauthenticate(runtime, request, actor, confirmation);

	if (verification !== 'verified') {
		return verification;
	}

	await deleteArchive(dataPaths(runtime.env), name);
	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: actor.id,
		action: 'backup.deleted',
		targetType: 'backup',
		details: { archive: name },
		ip: request.ip,
		userAgent: request.userAgent
	});

	return 'deleted';
}

export async function requestPanelRestore(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	name: string,
	confirmation: ProtectedActionInput,
	confirmed: boolean
): Promise<RestoreRequestResult> {
	if (!requireBackupAccess(actor)) {
		return { status: 'two_factor_required' };
	}

	const path = await existingArchive(runtime, name);

	if (path === null) {
		return { status: 'not_found' };
	}

	if (!confirmed) {
		return { status: 'not_confirmed' };
	}

	if (backupJobs(runtime).state().current !== null) {
		return { status: 'busy' };
	}

	const verification = await reauthenticate(runtime, request, actor, confirmation);

	if (verification !== 'verified') {
		return { status: verification };
	}

	const paths = dataPaths(runtime.env);
	const checked = await checkArchive(path, paths.dataDir);

	if (checked.status === 'invalid_archive') {
		return { status: 'invalid_archive', problem: restoreProblem(checked.reason) };
	}

	await requestRestore(paths, {
		archive: name,
		requestedBy: actor.email,
		requestedAt: new Date().toISOString()
	});
	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: actor.id,
		action: 'backup.restore_requested',
		targetType: 'backup',
		details: { archive: name },
		ip: request.ip,
		userAgent: request.userAgent
	});

	return { status: 'scheduled' };
}
