import type { Snippet } from 'svelte';

export interface ToolbarButtonProps {
	label: string;
	shortcut?: string;
	active?: boolean;
	disabled?: boolean;
	onclick: () => void;
	children: Snippet;
}
