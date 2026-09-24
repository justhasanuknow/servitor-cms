import type { Editor } from './editor';

export function useEditorState<Value>(
	editor: Editor,
	selector: (editor: Editor) => Value
): { readonly current: Value } {
	let current = $state.raw(selector(editor));

	$effect(() => {
		const handler = () => {
			current = selector(editor);
		};

		editor.on('transaction', handler);

		return () => {
			editor.off('transaction', handler);
		};
	});

	return {
		get current() {
			return current;
		}
	};
}
