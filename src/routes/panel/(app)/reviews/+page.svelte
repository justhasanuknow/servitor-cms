<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import * as Card from '$lib/components/ui/card';
	import { languageLabel, postTitle } from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const decided = $derived(page.url.searchParams.get('decided'));
</script>

<svelte:head>
	<title>{m.reviews_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.reviews_title()}</h1>
		<p class="text-muted-foreground">{m.reviews_description()}</p>
	</div>
	{#if decided === 'approved'}
		<Alert.Root>
			<Alert.Description>{m.reviews_decided_approved()}</Alert.Description>
		</Alert.Root>
	{:else if decided === 'rejected'}
		<Alert.Root>
			<Alert.Description>{m.reviews_decided_rejected()}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content>
			{#if data.queue.length === 0}
				<p class="text-sm text-muted-foreground">{m.reviews_empty()}</p>
			{:else}
				<ul class="grid gap-3" data-testid="review-queue">
					{#each data.queue as item (item.revisionId)}
						<li class="grid gap-1 rounded-2xl border p-3">
							<a
								href={resolve(`/panel/reviews/${item.postId}/${item.languageCode}`)}
								class="font-medium underline-offset-4 hover:underline"
							>
								{postTitle(item.title)}
							</a>
							<span class="text-xs text-muted-foreground">
								{languageLabel(data.languages, item.languageCode)} ·
								{m.reviews_submitted_by({ name: item.ownerName })} ·
								<FormattedDate value={item.submittedAt} />
							</span>
							<span class="text-xs text-muted-foreground">
								{#if item.update}
									{m.reviews_kind_update()}
								{:else}
									{m.reviews_kind_new()}
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</section>
