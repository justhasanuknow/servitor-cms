<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	{#if notFound}
		<title>{m.error_not_found_title()}</title>
	{:else}
		<title>{m.error_generic_title()}</title>
	{/if}
</svelte:head>
<main class="mx-auto max-w-xl px-4 py-16">
	{#if notFound}
		<h1 class="text-2xl font-semibold">{m.error_not_found_title()}</h1>
		<p class="mt-2 text-muted-foreground">{m.error_not_found_description()}</p>
	{:else}
		<h1 class="text-2xl font-semibold">{m.error_generic_title()}</h1>
		<p class="mt-2 text-muted-foreground">{m.error_generic_description()}</p>
		{#if page.error?.correlationId}
			<p class="mt-4 text-sm text-muted-foreground">
				{m.error_reference({ id: page.error.correlationId })}
			</p>
		{/if}
	{/if}
</main>
