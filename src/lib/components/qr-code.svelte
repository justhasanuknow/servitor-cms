<script lang="ts">
	import type { QrCodeProps } from './qr-code.interfaces';

	let { shape, label }: QrCodeProps = $props();
</script>

<svg
	viewBox="0 0 {shape.size} {shape.size}"
	role="img"
	aria-label={label}
	shape-rendering="crispEdges"
	class="size-48 rounded-2xl border"
>
	<rect width={shape.size} height={shape.size} fill="#ffffff" />
	<path d={shape.path} fill="#000000" />
</svg>
