<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{m.panel_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-4">
	<h1 class="text-2xl font-semibold">{m.panel_welcome({ name: data.viewer.name })}</h1>
	<p class="max-w-prose text-muted-foreground">{m.panel_welcome_description()}</p>
	<div class="flex flex-wrap gap-3">
		<Button href={resolve('/docs')}>{m.panel_open_docs()}</Button>
		<Button href={resolve('/panel/account/sessions')} variant="outline">
			{m.panel_manage_account()}
		</Button>
	</div>
</section>
