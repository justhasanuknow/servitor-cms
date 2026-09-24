<script lang="ts">
	import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
	import { untrack } from 'svelte';
	import type { BubbleMenuProps } from './bubble-menu.interfaces';

	let {
		editor,
		pluginKey,
		shouldShow,
		options = {},
		updateDelay = undefined,
		class: className,
		children
	}: BubbleMenuProps = $props();

	let root: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (root === undefined) {
			return;
		}

		const element = root;
		const key = pluginKey;

		untrack(() => {
			element.style.visibility = 'hidden';
			element.style.position = 'absolute';
			element.remove();
			editor.registerPlugin(
				BubbleMenuPlugin({
					editor,
					element,
					pluginKey: key,
					shouldShow,
					options,
					updateDelay
				})
			);
		});

		return () => {
			if (!editor.isDestroyed) {
				editor.unregisterPlugin(key);
			}
		};
	});
</script>

<div bind:this={root} class={className}>
	{@render children()}
</div>
