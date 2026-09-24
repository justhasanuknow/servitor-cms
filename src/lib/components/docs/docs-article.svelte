<script lang="ts">
	import { resolve } from '$app/paths';
	import ContentHtml from '$lib/components/content/content-html.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { cn } from '$lib/utils';
	import type { DocsArticleProps } from './docs-article.interfaces';

	let { view }: DocsArticleProps = $props();

	const locale = getLocale();
</script>

<svelte:head>
	<title>{view.page.title} · {m.docs_title()} · {m.app_name()}</title>
	<meta name="robots" content="noindex" />
</svelte:head>
<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_13rem]">
	<article class="min-w-0" lang="en">
		<h1 class="text-3xl font-bold tracking-tight text-balance">{view.page.title}</h1>
		{#if locale !== 'en'}
			<p class="mt-3 text-sm text-muted-foreground" lang={locale}>{m.docs_english_only()}</p>
		{/if}
		<ContentHtml sanitizedHtml={view.page.html} lang="en" class="mt-8" />
		{#if view.previous !== null || view.next !== null}
			<nav
				aria-label={m.docs_pages()}
				class="mt-14 grid gap-4 border-t pt-6 sm:grid-cols-2"
				lang={locale}
			>
				{#if view.previous !== null}
					<a
						href={resolve(view.previous.path)}
						rel="prev"
						class="grid gap-1 rounded-2xl border p-4 hover:bg-accent"
					>
						<span class="text-xs text-muted-foreground">{m.docs_previous()}</span>
						<span class="font-medium" lang="en">{view.previous.title}</span>
					</a>
				{/if}
				{#if view.next !== null}
					<a
						href={resolve(view.next.path)}
						rel="next"
						class="grid gap-1 rounded-2xl border p-4 text-end hover:bg-accent sm:col-start-2"
					>
						<span class="text-xs text-muted-foreground">{m.docs_next()}</span>
						<span class="font-medium" lang="en">{view.next.title}</span>
					</a>
				{/if}
			</nav>
		{/if}
	</article>
	{#if view.page.headings.length > 0}
		<aside class="hidden xl:block">
			<nav aria-label={m.docs_on_this_page()} class="sticky top-8 grid gap-2" lang={locale}>
				<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
					{m.docs_on_this_page()}
				</p>
				<ul class="grid gap-1 text-sm" lang="en">
					{#each view.page.headings as heading (heading.id)}
						<li class={cn(heading.depth === 3 && 'ps-3')}>
							<a
								href={`#${heading.id}`}
								class="text-muted-foreground hover:text-foreground"
							>
								{heading.text}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>
	{/if}
</div>
