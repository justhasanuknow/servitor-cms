export interface MediaPickerItem {
	id: string;
	width: number;
	height: number;
	alt: string;
}

export interface MediaPickerPage {
	items: MediaPickerItem[];
	page: number;
	pageCount: number;
}
