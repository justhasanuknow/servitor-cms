<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ContentHtml from '$lib/components/content/content-html.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { MEDIA_THUMBNAIL_VARIANT } from '$lib/constants/media';
	import { mediaUrl } from '$lib/content/media-urls';
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

	const reviewLabel = $derived(reviewStateLabel(data.revision.reviewState));
</script>

<svelte:head>
	<title>{postTitle(data.revision.title)} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-2">
		<a
			href={resolve(`/panel/posts/${data.postId}/${data.languageCode}/revisions`)}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.revisions_back_to_history()}
		</a>
		<h1 class="text-2xl font-semibold">{postTitle(data.revision.title)}</h1>
		<p class="text-sm text-muted-foreground">
			{languageLabel(data.languages, data.languageCode)} ·
			<FormattedDate value={data.revision.createdAt} /> ·
			{data.revision.authorName}
		</p>
		{#if reviewLabel !== null}
			<p class="text-sm text-muted-foreground">{reviewLabel}</p>
		{/if}
		{#if data.revision.reviewNote !== null}
			<Alert.Root>
				<Alert.Description>
					{m.revisions_review_note({ note: data.revision.reviewNote })}
				</Alert.Description>
			</Alert.Root>
		{/if}
	</div>
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if data.canRestore}
		<form method="POST" action="?/restore" use:enhance>
			<Button type="submit">{m.revisions_restore()}</Button>
		</form>
	{/if}
	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
		<Card.Root>
			<Card.Content>
				<ContentHtml
					sanitizedHtml={data.revision.contentHtml}
					lang={data.languageCode}
					class="mx-auto max-w-3xl"
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content>
				<dl class="grid gap-3 text-sm">
					<div class="grid gap-1">
						<dt class="text-muted-foreground">{m.posts_field_slug()}</dt>
						<dd class="break-all">{data.revision.slug}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-muted-foreground">{m.posts_field_excerpt()}</dt>
						<dd>{data.revision.excerpt}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-muted-foreground">{m.posts_field_tags()}</dt>
						<dd>{data.revision.tags.join(', ')}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-muted-foreground">{m.posts_field_meta_title()}</dt>
						<dd>{data.revision.metaTitle ?? ''}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-muted-foreground">{m.posts_field_meta_description()}</dt>
						<dd>{data.revision.metaDescription ?? ''}</dd>
					</div>
					{#if data.revision.ogMediaId !== null}
						<div class="grid gap-1">
							<dt class="text-muted-foreground">{m.posts_field_og_image()}</dt>
							<dd>
								<img
									src={mediaUrl(data.revision.ogMediaId, MEDIA_THUMBNAIL_VARIANT)}
									alt=""
									class="aspect-video w-full rounded-xl border object-cover"
								/>
							</dd>
						</div>
					{/if}
					<div class="grid gap-1">
						<dt class="text-muted-foreground">{m.posts_reading_time_label()}</dt>
						<dd>
							{m.posts_reading_time({
								minutes: String(data.revision.readingTimeMinutes)
							})}
						</dd>
					</div>
				</dl>
			</Card.Content>
		</Card.Root>
	</div>
</section>
