export interface PendingRestore {
	archive: string;
	requestedBy: string;
	requestedAt: string;
}

export type RestoreProblem =
	'newer_version' | 'schema' | 'foreign' | 'space' | 'contents' | 'format' | 'damaged';

export type RestoreOutcome =
	| {
			status: 'restored';
			archive: string;
			requestedBy: string;
			finishedAt: string;
			previousDataDir: string;
	  }
	| {
			status: 'failed';
			archive: string;
			requestedBy: string;
			finishedAt: string;
			problem: RestoreProblem;
			reason: string;
	  };
