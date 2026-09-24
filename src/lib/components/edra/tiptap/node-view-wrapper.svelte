<script lang="ts">
	import { getNodeViewDragStart } from './node-view-context';
	import type { NodeViewWrapperProps } from './node-view.interfaces';

	let { as = 'div', children, ...rest }: NodeViewWrapperProps = $props();

	const dragStart = getNodeViewDragStart();

	function handleDragStart(event: DragEvent): void {
		dragStart?.()(event);
	}
</script>

<svelte:element
	this={as}
	data-node-view-wrapper=""
	style="white-space: normal"
	ondragstart={handleDragStart}
	{...rest}
>
	{@render children?.()}
</svelte:element>
