<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { m } from '$lib/paraglide/messages';
	import type { PagerProps } from './pager.interfaces';

	let { page, pageCount, label, params = {} }: PagerProps = $props();

	const hidden = $derived(Object.entries(params).filter(([, value]) => value !== ''));
</script>

{#if pageCount > 1}
	<form method="GET" aria-label={label} class="flex items-center justify-between gap-4">
		{#each hidden as [key, value] (key)}
			<input type="hidden" name={key} {value} />
		{/each}
		<Button
			type="submit"
			name="page"
			value={String(page - 1)}
			variant="outline"
			size="sm"
			disabled={page <= 1}
		>
			{m.pager_previous()}
		</Button>
		<span class="text-sm text-muted-foreground">
			{m.pager_page({ page: String(page), total: String(pageCount) })}
		</span>
		<Button
			type="submit"
			name="page"
			value={String(page + 1)}
			variant="outline"
			size="sm"
			disabled={page >= pageCount}
		>
			{m.pager_next()}
		</Button>
	</form>
{/if}
