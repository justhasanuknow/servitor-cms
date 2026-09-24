import { OrderedList } from '@tiptap/extension-list';
import { MAX_ORDERED_LIST_START, ORDERED_LIST_TYPES } from '../../constants/content';

const START_PATTERN = /^[0-9]{1,7}$/;

export const ContentOrderedList = OrderedList.extend({
	addAttributes() {
		return {
			start: {
				default: 1,
				parseHTML: (element: HTMLElement) => listStart(element.getAttribute('start'))
			},
			type: {
				default: null,
				parseHTML: (element: HTMLElement) => listType(element.getAttribute('type'))
			}
		};
	}
});

export function isOrderedListType(value: string): boolean {
	return ORDERED_LIST_TYPES.some((type) => type === value);
}

function listStart(value: string | null): number {
	if (value === null || !START_PATTERN.test(value)) {
		return 1;
	}

	return Math.min(Number(value), MAX_ORDERED_LIST_START);
}

function listType(value: string | null): string | null {
	if (value === null || !isOrderedListType(value)) {
		return null;
	}

	return value;
}
