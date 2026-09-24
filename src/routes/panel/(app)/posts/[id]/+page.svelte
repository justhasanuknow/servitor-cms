<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import TranslationStatusBadge from '$lib/components/posts/translation-status-badge.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { languageLabel, moderationErrorMessage, postTitle } from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	const MAX_REASON_LENGTH = 1000;

	let { data, form }: PageProps = $props();

	const title = $derived(postTitle(data.translations[0]?.title ?? ''));
	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return moderationErrorMessage(form.error);
	});
	const moderated = $derived.by(() => {
		if (!form || !('moderated' in form)) {
			return null;
		}

		return form.moderated;
	});
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
	{#if moderated === 'hidden'}
		<Alert.Root>
			<Alert.Description>{m.moderation_done_hidden()}</Alert.Description>
		</Alert.Root>
	{:else if moderated === 'unhidden'}
		<Alert.Root>
			<Alert.Description>{m.moderation_done_unhidden()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
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
	{#if data.canModerate}
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.moderation_title()}</h2></Card.Title>
				<Card.Description>{m.moderation_description()}</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.post.hiddenByModerator}
					<form method="POST" action="?/unhide" class="grid gap-3" use:enhance>
						<p class="text-sm">
							{m.moderation_hidden({ reason: data.post.hiddenReason ?? '' })}
						</p>
						<div>
							<Button type="submit" variant="outline">{m.moderation_unhide()}</Button>
						</div>
					</form>
				{:else}
					<form method="POST" action="?/hide" class="grid max-w-xl gap-2" use:enhance>
						<Label for="moderation-reason">{m.moderation_reason()}</Label>
						<Textarea
							id="moderation-reason"
							name="reason"
							rows={3}
							maxlength={MAX_REASON_LENGTH}
							required
						/>
						<div>
							<Button type="submit" variant="destructive"
								>{m.moderation_hide()}</Button
							>
						</div>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</section>
