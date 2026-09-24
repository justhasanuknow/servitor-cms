<script lang="ts">
	import { resolve } from '$app/paths';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import TranslationStatusBadge from '$lib/components/posts/translation-status-badge.svelte';
	import * as Card from '$lib/components/ui/card';
	import { languageLabel, postTitle } from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const title = $derived(postTitle(data.translations[0]?.title ?? ''));
</script>

<svelte:head>
	<title>{title} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-2">
		<a
			href={resolve('/panel/posts')}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.posts_back()}
		</a>
		<h1 class="text-2xl font-semibold">{title}</h1>
		<p class="text-sm text-muted-foreground">
			{m.posts_owner({ name: data.post.ownerName })} ·
			<FormattedDate value={data.post.updatedAt} />
		</p>
		<p class="text-sm text-muted-foreground">{m.posts_read_only()}</p>
	</div>
	<Card.Root>
		<Card.Content>
			{#if data.translations.length === 0}
				<p class="text-sm text-muted-foreground">{m.posts_no_translations()}</p>
			{:else}
				<ul class="grid gap-3">
					{#each data.translations as translation (translation.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
						>
							<div class="grid gap-1">
								<span class="font-medium">{postTitle(translation.title)}</span>
								<span class="text-xs text-muted-foreground">
									{languageLabel(data.languages, translation.languageCode)}
								</span>
							</div>
							<div class="flex items-center gap-3">
								<TranslationStatusBadge
									status={translation.status}
									pendingChanges={translation.hasPendingChanges}
								/>
								<a
									href={resolve(
										`/panel/posts/${data.post.id}/${translation.languageCode}/revisions`
									)}
									class="text-sm underline-offset-4 hover:underline"
								>
									{m.revisions_title()}
								</a>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</section>
