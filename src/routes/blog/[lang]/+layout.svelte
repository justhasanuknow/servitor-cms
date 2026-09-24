<script lang="ts">
	import Rss from '@lucide/svelte/icons/rss';
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const languageCode = $derived(data.language.code);
</script>

<a
	href="#public-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
>
	{m.public_skip_to_content()}
</a>
<div class="flex min-h-dvh flex-col bg-background text-foreground">
	<header class="border-b">
		<div
			class="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-5"
		>
			<a
				href={resolve(`/blog/${languageCode}`)}
				class="text-lg font-semibold tracking-tight hover:opacity-80"
			>
				{data.siteName}
			</a>
			<a
				href={resolve(`/blog/${languageCode}/rss.xml`)}
				class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
			>
				<Rss class="size-4" aria-hidden="true" />
				{m.public_feed()}
			</a>
		</div>
	</header>
	<main id="public-content" class="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
		{@render children()}
	</main>
	<footer class="border-t">
		<nav
			aria-label={m.public_languages()}
			class="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm"
		>
			<span class="text-muted-foreground">{m.public_languages()}</span>
			<ul class="flex flex-wrap gap-x-4 gap-y-2">
				{#each data.languages as language (language.code)}
					<li>
						<a
							href={resolve(`/blog/${language.code}`)}
							hreflang={language.code}
							lang={language.code}
							aria-current={language.code === languageCode}
							class={cn(
								'underline-offset-4 hover:underline',
								language.code === languageCode && 'font-medium'
							)}
						>
							{language.nativeName}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</footer>
</div>
