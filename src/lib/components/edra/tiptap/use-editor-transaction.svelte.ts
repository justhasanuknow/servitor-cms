import type { Editor } from './editor';

export function useEditorTransaction(editor: Editor): { readonly version: number } {
	let version = $state(0);

	$effect(() => {
		const handler = () => {
			version += 1;
		};

		editor.on('transaction', handler);

		return () => {
			editor.off('transaction', handler);
		};
	});

	return {
		get version() {
			return version;
		}
	};
}
