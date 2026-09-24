export interface BackupUploadProps {
	chunkBytes: number;
	onUploaded: () => void;
}

export interface UploadAnswer {
	status: string;
	id?: string;
	archive?: string;
	problem?: string;
}

export interface PendingUpload {
	id: string;
	file: File;
}
