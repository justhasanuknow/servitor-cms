<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';

	const content = $derived.by(() => {
		if (page.status === 404) {
			return {
				title: m.error_not_found_title(),
				description: m.error_not_found_description(),
				showReference: false
			};
		}

		if (page.status === 403) {
			return {
				title: m.error_forbidden_title(),
				description: m.error_forbidden_description(),
				showReference: false
			};
		}

		return {
			title: m.error_generic_title(),
			description: m.error_generic_description(),
			showReference: true
		};
	});
</script>

<svelte:head>
	<title>{content.title}</title>
</svelte:head>
<main class="mx-auto max-w-xl px-4 py-16">
	<h1 class="text-2xl font-semibold">{content.title}</h1>
	<p class="mt-2 text-muted-foreground">{content.description}</p>
	{#if content.showReference && page.error?.correlationId}
		<p class="mt-4 text-sm text-muted-foreground">
			{m.error_reference({ id: page.error.correlationId })}
		</p>
	{/if}
</main>
