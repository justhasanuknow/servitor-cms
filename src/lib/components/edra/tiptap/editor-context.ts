import { getContext, setContext } from 'svelte';
import type { Editor } from './editor';

const EDITOR_CONTEXT = Symbol('edra-editor');

export function getEditor(): Editor {
	const editor = getContext<Editor | undefined>(EDITOR_CONTEXT);

	if (editor === undefined) {
		throw new Error('No editor found in context');
	}

	return editor;
}

export function setEditor(editor: Editor): void {
	setContext(EDITOR_CONTEXT, editor);
}
