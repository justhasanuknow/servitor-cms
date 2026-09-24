<script lang="ts">
	import type { NodeViewContentProps } from './node-view.interfaces';

	let { as = 'div', class: className }: NodeViewContentProps = $props();
</script>

<svelte:element this={as} class={className} data-node-view-content="" style="white-space: pre-wrap"
></svelte:element>
