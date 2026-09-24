import { TableCell, TableHeader } from '@tiptap/extension-table';
import { MAX_TABLE_SPAN } from '../../constants/content';

const SPAN_PATTERN = /^[1-9][0-9]{0,2}$/;

function spanAttributes() {
	return {
		colspan: {
			default: 1,
			parseHTML: (element: HTMLElement) => cellSpan(element.getAttribute('colspan'))
		},
		rowspan: {
			default: 1,
			parseHTML: (element: HTMLElement) => cellSpan(element.getAttribute('rowspan'))
		}
	};
}

export const ContentTableCell = TableCell.extend({
	addAttributes() {
		return spanAttributes();
	}
});

export const ContentTableHeader = TableHeader.extend({
	addAttributes() {
		return spanAttributes();
	}
});

function cellSpan(value: string | null): number {
	if (value === null || !SPAN_PATTERN.test(value)) {
		return 1;
	}

	return Math.min(Number(value), MAX_TABLE_SPAN);
}
