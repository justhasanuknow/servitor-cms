import type { BackupSource, CreatedBackupSource } from '../operations/backup.interfaces';
import type {
	ProtectedActionInput,
	ReauthenticationFailure
} from '../auth/two-factor-settings.interfaces';
import type { RestoreOutcome, RestoreProblem } from '../operations/restore-request.interfaces';

export type ArchiveKind = 'backup' | 'auto' | 'upload';

export interface ArchiveEntry {
	name: string;
	kind: ArchiveKind;
	size: number;
	createdAt: Date;
	appVersion: string | null;
	source: BackupSource | null;
}

export interface CachedArchive {
	key: string;
	entry: ArchiveEntry;
}

export interface StorageSummary {
	freeBytes: number;
	archiveBytes: number;
}

export type BackupFrequency = 'off' | 'daily' | 'weekly';

export interface BackupScheduleSettings {
	frequency: BackupFrequency;
	hour: number;
	retention: number;
}

export interface BackupScheduleView extends BackupScheduleSettings {
	updatedAt: Date | null;
}

export type BackupJobStatus = 'running' | 'succeeded' | 'failed';

export interface BackupJob {
	id: string;
	source: Exclude<CreatedBackupSource, 'cli'>;
	requestedBy: string | null;
	status: BackupJobStatus;
	startedAt: Date;
	finishedAt: Date | null;
	archive: string | null;
	error: string | null;
}

export interface BackupJobsState {
	current: BackupJob | null;
	last: BackupJob | null;
}

export type BackupJobStart = { status: 'started'; job: BackupJob } | { status: 'busy' };

export type ScheduleUpdateResult =
	'updated' | 'unchanged' | 'two_factor_required' | ReauthenticationFailure;

export interface UploadSession {
	id: string;
	ownerId: string;
	size: number;
	received: number;
	path: string;
	createdAt: Date;
}

export type UploadStartResult =
	| { status: 'started'; id: string; chunkBytes: number }
	| { status: 'two_factor_required' }
	| { status: 'rate_limited' }
	| { status: 'invalid_size' }
	| { status: 'insufficient_space' };

export type UploadAppendResult =
	| { status: 'received'; received: number }
	| { status: 'out_of_order'; received: number }
	| { status: 'not_found' }
	| { status: 'two_factor_required' };

export type UploadCompleteResult =
	| { status: 'uploaded'; archive: string }
	| { status: 'invalid_archive'; problem: RestoreProblem }
	| { status: 'passphrase_required' }
	| { status: 'wrong_passphrase' }
	| { status: 'incomplete' }
	| { status: 'not_found' }
	| { status: 'two_factor_required' };

export interface BackupsOverview {
	allowed: boolean;
	archives: ArchiveEntry[];
	storage: StorageSummary;
	jobs: BackupJobsState;
	schedule: BackupScheduleView;
	nextScheduled: Date | null;
	lastRestore: RestoreOutcome | null;
	restorePending: boolean;
}

export type ManualBackupResult = 'started' | 'busy' | 'two_factor_required';

export interface DownloadInput {
	passphrase: string;
	passphraseConfirmation: string;
	confirmation: ProtectedActionInput;
}

export type DownloadAuthorization =
	| { status: 'authorized'; path: string; name: string; passphrase: string | null }
	| { status: 'not_found' }
	| { status: 'two_factor_required' }
	| { status: 'passphrase_mismatch' }
	| { status: 'passphrase_too_short' }
	| { status: 'passphrase_too_long' }
	| { status: ReauthenticationFailure };

export type DeleteResult =
	'deleted' | 'not_found' | 'two_factor_required' | ReauthenticationFailure;

export type RestoreRequestResult =
	| { status: 'scheduled' }
	| { status: 'not_found' }
	| { status: 'not_confirmed' }
	| { status: 'busy' }
	| { status: 'two_factor_required' }
	| { status: 'invalid_archive'; problem: RestoreProblem }
	| { status: ReauthenticationFailure };
