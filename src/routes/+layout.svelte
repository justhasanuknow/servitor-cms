<script lang="ts">
	import './layout.css';
	import { asset } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={asset('/favicon.ico')} sizes="32x32" />
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="apple-touch-icon" href={asset('/apple-touch-icon.png')} />
</svelte:head>
{@render children()}
