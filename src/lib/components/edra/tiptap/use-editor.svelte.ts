import type { EditorOptions } from '@tiptap/core';
import { browser } from '$app/environment';
import { Editor } from './editor';

export function useEditor(options: Partial<EditorOptions> = {}): Editor | undefined {
	let editor: Editor | undefined;

	if (browser) {
		editor = new Editor(options);
	}

	$effect(() => {
		return () => {
			if (editor === undefined) {
				return;
			}

			const container = editor.view.dom?.parentNode;
			const snapshot = container?.cloneNode(true);

			if (container && snapshot) {
				container.parentNode?.replaceChild(snapshot, container);
			}

			editor.destroy();
		};
	});

	return editor;
}
