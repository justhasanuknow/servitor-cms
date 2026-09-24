<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import PublicDate from './public-date.svelte';
	import PublicImage from './public-image.svelte';
	import type { PostListProps } from './post-list.interfaces';

	let { posts }: PostListProps = $props();
</script>

{#if posts.length === 0}
	<p class="text-muted-foreground">{m.public_empty()}</p>
{:else}
	<ol class="grid gap-10" data-testid="public-post-list">
		{#each posts as post (post.translationId)}
			<li>
				<article class="grid gap-3">
					{#if post.cover !== null}
						<a href={resolve(`/blog/${post.languageCode}/${post.slug}`)} tabindex="-1">
							<PublicImage image={post.cover} class="aspect-[2/1]" />
						</a>
					{/if}
					<h2
						class="text-2xl font-semibold tracking-tight text-balance"
						lang={post.languageCode}
					>
						<a
							href={resolve(`/blog/${post.languageCode}/${post.slug}`)}
							class="underline-offset-4 hover:underline"
						>
							{post.title}
						</a>
					</h2>
					<p class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
						{#if post.publishedAt !== null}
							<PublicDate value={post.publishedAt} />
						{/if}
						<span>{m.public_by({ name: post.authorName })}</span>
						<span
							>{m.posts_reading_time({
								minutes: String(post.readingTimeMinutes)
							})}</span
						>
					</p>
					{#if post.excerpt !== ''}
						<p class="leading-relaxed text-pretty" lang={post.languageCode}>
							{post.excerpt}
						</p>
					{/if}
				</article>
			</li>
		{/each}
	</ol>
{/if}
