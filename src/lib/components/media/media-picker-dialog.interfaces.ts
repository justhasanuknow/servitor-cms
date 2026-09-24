import type { MediaPickerItem } from '$lib/modules/interfaces/media.interfaces';

export interface MediaPickerDialogProps {
	open: boolean;
	languageCode: string;
	onSelect: (item: MediaPickerItem) => void;
}
