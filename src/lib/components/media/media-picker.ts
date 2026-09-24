import type { MediaPickerItem, MediaPickerPage } from '$lib/modules/interfaces/media.interfaces';

export function isMediaPickerPage(value: unknown): value is MediaPickerPage {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	if (!('items' in value) || !('page' in value) || !('pageCount' in value)) {
		return false;
	}

	return (
		Array.isArray(value.items) &&
		value.items.every(isMediaPickerItem) &&
		typeof value.page === 'number' &&
		typeof value.pageCount === 'number'
	);
}

function isMediaPickerItem(value: unknown): value is MediaPickerItem {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	if (!('id' in value) || !('width' in value) || !('height' in value) || !('alt' in value)) {
		return false;
	}

	return (
		typeof value.id === 'string' &&
		typeof value.width === 'number' &&
		typeof value.height === 'number' &&
		typeof value.alt === 'string'
	);
}
