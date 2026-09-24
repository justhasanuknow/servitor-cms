import { m } from '$lib/paraglide/messages';
import type { QuickColor } from './colors.interfaces';

const HIGHLIGHT_ALPHA = '50';

export function quickColors(): QuickColor[] {
	return [
		{ id: 'gray', label: m.editor_color_gray(), value: '#636262' },
		{ id: 'brown', label: m.editor_color_brown(), value: '#7d0404' },
		{ id: 'red', label: m.editor_color_red(), value: '#b30707' },
		{ id: 'orange', label: m.editor_color_orange(), value: '#a34603' },
		{ id: 'yellow', label: m.editor_color_yellow(), value: '#9a8a00' },
		{ id: 'green', label: m.editor_color_green(), value: '#077507' },
		{ id: 'blue', label: m.editor_color_blue(), value: '#0e4fb3' },
		{ id: 'purple', label: m.editor_color_purple(), value: '#83069c' },
		{ id: 'pink', label: m.editor_color_pink(), value: '#db0762' }
	];
}

export function highlightColor(value: string): string {
	return `${value}${HIGHLIGHT_ALPHA}`;
}
