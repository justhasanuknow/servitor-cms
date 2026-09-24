<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion, Tween } from 'svelte/motion';
	import { navigating } from '$app/state';

	const progress = new Tween(0, { easing: cubicOut });

	const loading = $derived(navigating.to !== null);

	function animate(active: boolean, reduceMotion: boolean): void {
		let duration = 1600;
		let settle = 240;

		if (reduceMotion) {
			duration = 0;
			settle = 0;
		}

		if (active) {
			void progress.set(0, { duration: 0 }).then(() => progress.set(0.85, { duration }));

			return;
		}

		if (progress.current > 0) {
			void progress.set(1, { duration: settle }).then(() => progress.set(0, { duration: 0 }));
		}
	}

	$effect(() => {
		const active = loading;
		const reduceMotion = prefersReducedMotion.current;

		untrack(() => animate(active, reduceMotion));
	});
</script>

{#if progress.current > 0}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary"
		style:transform="scaleX({progress.current})"
		aria-hidden="true"
	></div>
{/if}
