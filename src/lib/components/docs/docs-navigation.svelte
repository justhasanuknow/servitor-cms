<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import { docsSectionLabel } from './docs-labels';
	import type { DocsNavigationProps } from './docs-navigation.interfaces';

	let { sections, currentSlug }: DocsNavigationProps = $props();
</script>

{#snippet pageList()}
	<a
		href={resolve('/docs')}
		aria-current={currentSlug === null && 'page'}
		class={cn(
			'block rounded-3xl px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
			currentSlug === null && 'bg-accent font-medium text-accent-foreground'
		)}
	>
		{m.docs_overview()}
	</a>
	{#each sections as section (section.id)}
		<div class="grid gap-1">
			<p class="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{docsSectionLabel(section.id)}
			</p>
			<ul class="grid gap-0.5">
				{#each section.pages as link (link.path)}
					{@const current = currentSlug === link.slug}
					<li>
						<a
							href={resolve(link.path)}
							aria-current={current && 'page'}
							class={cn(
								'block rounded-3xl px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
								current && 'bg-accent font-medium text-accent-foreground'
							)}
						>
							{link.title}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
{/snippet}
<details class="rounded-2xl border md:hidden">
	<summary class="cursor-pointer px-4 py-3 text-sm font-medium">{m.docs_contents()}</summary>
	<nav aria-label={m.docs_title()} class="grid gap-5 px-2 pb-4">
		{@render pageList()}
	</nav>
</details>
<nav aria-label={m.docs_title()} class="hidden content-start gap-5 md:grid">
	{@render pageList()}
</nav>
