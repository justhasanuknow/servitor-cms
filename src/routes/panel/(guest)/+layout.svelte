<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<main class="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
	{@render children()}
</main>
