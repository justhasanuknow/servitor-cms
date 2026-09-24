<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DocsNavigation from '$lib/components/docs/docs-navigation.svelte';
	import { m } from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<a
	href="#docs-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
>
	{m.public_skip_to_content()}
</a>
<div class="flex min-h-dvh flex-col bg-background text-foreground">
	<header class="border-b">
		<div
			class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4"
		>
			<a href={resolve('/docs')} class="flex items-baseline gap-2 hover:opacity-80">
				<span class="text-lg font-semibold tracking-tight">{m.app_name()}</span>
				<span class="text-sm text-muted-foreground">{m.docs_title()}</span>
			</a>
			<a
				href={resolve('/panel')}
				class="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
			>
				{#if data.signedIn}
					{m.docs_back_to_panel()}
				{:else}
					{m.docs_open_panel()}
				{/if}
			</a>
		</div>
	</header>
	<div
		class="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 md:grid-cols-[14rem_minmax(0,1fr)] md:py-10"
	>
		<DocsNavigation sections={data.sections} currentSlug={page.params.slug ?? null} />
		<main id="docs-content" class="min-w-0">
			{@render children()}
		</main>
	</div>
</div>
