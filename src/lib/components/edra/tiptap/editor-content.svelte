<script lang="ts">
	import { untrack } from 'svelte';
	import type { EditorContentProps } from './node-view.interfaces';

	let { editor, class: className }: EditorContentProps = $props();

	let root: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (root === undefined) {
			return;
		}

		const element = root;
		const view = editor.view.dom;

		if (!view?.parentNode || element.contains(view)) {
			return;
		}

		untrack(() => {
			const parent = view.parentNode;

			if (parent === null) {
				return;
			}

			element.append(...parent.childNodes);
			editor.setOptions({ element });
			editor.createNodeViews();
		});
	});
</script>

<div bind:this={root} class={className}></div>
