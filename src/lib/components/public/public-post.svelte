<script lang="ts">
	import { resolve } from '$app/paths';
	import ContentHtml from '$lib/components/content/content-html.svelte';
	import { m } from '$lib/paraglide/messages';
	import PublicDate from './public-date.svelte';
	import PublicImage from './public-image.svelte';
	import type { PublicPostProps } from './public-post.interfaces';

	let { post }: PublicPostProps = $props();

	const otherLanguages = $derived(
		post.alternates.filter((alternate) => alternate.languageCode !== post.languageCode)
	);
</script>

<article class="grid gap-8">
	<header class="grid gap-4">
		{#if post.category !== null}
			<a
				href={resolve(`/blog/${post.languageCode}/category/${post.category.slug}`)}
				lang={post.languageCode}
				class="w-fit text-sm font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
			>
				{post.category.name}
			</a>
		{/if}
		<h1
			class="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
			lang={post.languageCode}
		>
			{post.title}
		</h1>
		{#if post.excerpt !== ''}
			<p class="text-lg text-pretty text-muted-foreground" lang={post.languageCode}>
				{post.excerpt}
			</p>
		{/if}
		<p class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
			<span>{m.public_by({ name: post.authorName })}</span>
			{#if post.publishedAt !== null}
				<PublicDate value={post.publishedAt} />
			{/if}
			<span>{m.posts_reading_time({ minutes: String(post.readingTimeMinutes) })}</span>
		</p>
		{#if otherLanguages.length > 0}
			<nav
				aria-label={m.public_available_in()}
				class="flex flex-wrap gap-x-3 gap-y-1 text-sm"
			>
				<span class="text-muted-foreground">{m.public_available_in()}</span>
				<ul class="flex flex-wrap gap-x-3 gap-y-1">
					{#each otherLanguages as alternate (alternate.languageCode)}
						<li>
							<a
								href={resolve(`/blog/${alternate.languageCode}/${alternate.slug}`)}
								hreflang={alternate.languageCode}
								lang={alternate.languageCode}
								class="underline underline-offset-4"
							>
								{alternate.nativeName}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
	</header>
	{#if post.cover !== null}
		<PublicImage image={post.cover} loading="eager" />
	{/if}
	<ContentHtml sanitizedHtml={post.contentHtml} lang={post.languageCode} />
	{#if post.tags.length > 0}
		<footer class="grid gap-3 border-t pt-6">
			<h2 class="text-sm font-medium text-muted-foreground">{m.public_tags()}</h2>
			<ul class="flex flex-wrap gap-2" lang={post.languageCode}>
				{#each post.tags as tag (tag.slug)}
					<li>
						<a
							href={resolve(`/blog/${post.languageCode}/tag/${tag.slug}`)}
							class="inline-flex rounded-full border px-3 py-1 text-sm hover:bg-muted"
						>
							{tag.name}
						</a>
					</li>
				{/each}
			</ul>
		</footer>
	{/if}
</article>
