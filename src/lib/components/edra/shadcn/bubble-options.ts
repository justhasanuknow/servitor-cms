import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';
import type { Editor } from '../tiptap/editor';

export function bubbleOptions(editor: Editor): BubbleMenuPluginProps['options'] {
	return {
		strategy: 'absolute',
		placement: 'top',
		offset: 8,
		shift: { padding: 8 },
		flip: true,
		scrollTarget: editor.view.dom.parentElement ?? window
	};
}
