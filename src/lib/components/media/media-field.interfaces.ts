export interface MediaPreview {
	id: string;
	width: number;
	height: number;
}

export interface MediaFieldProps {
	id: string;
	label: string;
	description?: string;
	value: MediaPreview | null;
	languageCode: string;
	name?: string;
	disabled?: boolean;
	onChange?: (value: MediaPreview | null) => void;
}
