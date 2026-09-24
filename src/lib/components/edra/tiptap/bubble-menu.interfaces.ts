import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';
import type { Snippet } from 'svelte';
import type { Editor } from './editor';

export interface BubbleMenuProps {
	editor: Editor;
	pluginKey: string;
	shouldShow: BubbleMenuPluginProps['shouldShow'];
	options?: BubbleMenuPluginProps['options'];
	updateDelay?: number;
	class?: string;
	children: Snippet;
}
