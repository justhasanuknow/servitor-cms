<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import TranslationStatusBadge from '$lib/components/posts/translation-status-badge.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import {
		languageLabel,
		postErrorMessage,
		postTitle,
		reviewStateLabel
	} from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return postErrorMessage(form.error);
	});

	const backHref = $derived.by(() => {
		if (data.canEdit) {
			return resolve(`/panel/posts/${data.postId}/${data.languageCode}`);
		}

		return resolve(`/panel/posts/${data.postId}`);
	});
</script>

<svelte:head>
	<title>{m.revisions_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-2">
		<a href={backHref} class="text-sm text-muted-foreground underline-offset-4 hover:underline">
			{m.revisions_back()}
		</a>
		<h1 class="text-2xl font-semibold">{m.revisions_title()}</h1>
		<p class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
			<span>{languageLabel(data.languages, data.languageCode)}</span>
			<TranslationStatusBadge status={data.status} />
			<span>{m.posts_owner({ name: data.ownerName })}</span>
		</p>
		<p class="text-sm text-muted-foreground">{m.revisions_description()}</p>
	</div>
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content>
			{#if data.revisions.length === 0}
				<p class="text-sm text-muted-foreground">{m.revisions_empty()}</p>
			{:else}
				<ol class="grid gap-3" data-testid="revision-list">
					{#each data.revisions as revision (revision.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
						>
							<div class="grid gap-1">
								<a
									href={resolve(
										`/panel/posts/${data.postId}/${data.languageCode}/revisions/${revision.id}`
									)}
									class="font-medium underline-offset-4 hover:underline"
								>
									{postTitle(revision.title)}
								</a>
								<span class="text-xs text-muted-foreground">
									<FormattedDate value={revision.createdAt} /> ·
									{revision.authorName}
								</span>
								<span class="flex flex-wrap gap-2 text-xs">
									{#if revision.isLive}
										<span
											class="rounded-full bg-primary px-2 py-0.5 text-primary-foreground"
										>
											{m.revisions_live()}
										</span>
									{/if}
									{#if revision.isPending}
										<span
											class="rounded-full bg-secondary px-2 py-0.5 ring-1 ring-border"
										>
											{m.revisions_pending()}
										</span>
									{/if}
									{#if reviewStateLabel(revision.reviewState) !== null}
										<span class="rounded-full bg-muted px-2 py-0.5">
											{reviewStateLabel(revision.reviewState)}
										</span>
									{/if}
								</span>
							</div>
							{#if data.canRestore}
								<form method="POST" action="?/restore" use:enhance>
									<input type="hidden" name="revisionId" value={revision.id} />
									<Button type="submit" size="sm" variant="outline"
										>{m.revisions_restore()}</Button
									>
								</form>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</Card.Content>
	</Card.Root>
</section>
