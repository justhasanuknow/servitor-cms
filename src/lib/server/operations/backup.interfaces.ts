export interface DataPaths {
	dataDir: string;
	databasePath: string;
	uploadsDir: string;
	backupsDir: string;
}

export type BackupSource = 'cli' | 'panel' | 'schedule' | 'upload';

export type CreatedBackupSource = Exclude<BackupSource, 'upload'>;

export interface BackupManifest {
	format: number;
	createdAt: string;
	appVersion?: string;
	source?: CreatedBackupSource;
}

export interface CreateBackupOptions {
	source?: CreatedBackupSource;
	now?: Date;
}

export interface RestoreLimits {
	maxEntries: number;
	maxBytes: number;
}

export interface ArchiveSize {
	entries: number;
	bytes: number;
}

export type ArchiveCheckResult =
	| { status: 'valid'; manifest: BackupManifest; size: ArchiveSize }
	| { status: 'invalid_archive'; reason: string };

export type RestoreResult =
	| { status: 'restored'; previousDataDir: string }
	| { status: 'running' }
	| { status: 'invalid_archive'; reason: string };
