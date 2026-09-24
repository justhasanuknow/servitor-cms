<script lang="ts">
	import { setNodeViewDragStart } from './node-view-context';
	import type { NodeViewFrameProps } from './node-view.interfaces';

	let { component: View, onDragStart, ...props }: NodeViewFrameProps = $props();

	setNodeViewDragStart(() => onDragStart);
</script>

<View {...props} />
