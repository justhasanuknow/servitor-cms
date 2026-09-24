export interface DataPaths {
	dataDir: string;
	databasePath: string;
	uploadsDir: string;
	backupsDir: string;
}

export interface BackupManifest {
	format: number;
	createdAt: string;
}

export type RestoreResult =
	| { status: 'restored'; previousDataDir: string }
	| { status: 'running' }
	| { status: 'invalid_archive'; reason: string };
