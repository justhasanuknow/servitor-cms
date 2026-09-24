<script lang="ts">
	import { resolve } from '$app/paths';
	import ContentHtml from '$lib/components/content/content-html.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { languageLabel, postTitle, reviewErrorMessage } from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	const MAX_NOTE_LENGTH = 1000;

	let { data, form }: PageProps = $props();

	const review = $derived(data.review);
	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return reviewErrorMessage(form.error);
	});
</script>

<svelte:head>
	<title>{postTitle(review.pending.title)} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-2">
		<a
			href={resolve('/panel/reviews')}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.reviews_back()}
		</a>
		<h1 class="text-2xl font-semibold">{postTitle(review.pending.title)}</h1>
		<p class="text-sm text-muted-foreground">
			{languageLabel(data.languages, review.languageCode)} ·
			{m.reviews_submitted_by({ name: review.ownerName })} ·
			<FormattedDate value={review.pending.createdAt} />
		</p>
		{#if review.scheduledAt !== null && review.live === null}
			<p class="text-sm text-muted-foreground">
				{m.reviews_requested_schedule()}
				<FormattedDate value={review.scheduledAt} />
			</p>
		{/if}
	</div>
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
		<div class="grid content-start gap-6">
			<Card.Root>
				<Card.Header>
					<Card.Title><h2 class="font-semibold">{m.reviews_submission()}</h2></Card.Title>
				</Card.Header>
				<Card.Content>
					<ContentHtml
						sanitizedHtml={review.pending.contentHtml}
						lang={review.languageCode}
						class="mx-auto max-w-3xl"
					/>
				</Card.Content>
			</Card.Root>
			{#if review.live !== null}
				<Card.Root>
					<Card.Header>
						<Card.Title
							><h2 class="font-semibold">{m.reviews_live_version()}</h2></Card.Title
						>
						<Card.Description>{postTitle(review.live.title)}</Card.Description>
					</Card.Header>
					<Card.Content>
						<details>
							<summary class="cursor-pointer text-sm text-muted-foreground">
								{m.reviews_show_live()}
							</summary>
							<ContentHtml
								sanitizedHtml={review.live.contentHtml}
								lang={review.languageCode}
								class="mx-auto mt-4 max-w-3xl"
							/>
						</details>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
		<aside class="grid content-start gap-4">
			<Card.Root>
				<Card.Content>
					<dl class="grid gap-3 text-sm">
						<div class="grid gap-1">
							<dt class="text-muted-foreground">{m.posts_field_slug()}</dt>
							<dd class="break-all">{review.pending.slug}</dd>
						</div>
						<div class="grid gap-1">
							<dt class="text-muted-foreground">{m.posts_field_excerpt()}</dt>
							<dd>{review.pending.excerpt}</dd>
						</div>
						<div class="grid gap-1">
							<dt class="text-muted-foreground">{m.posts_field_tags()}</dt>
							<dd>{review.pending.tags.join(', ')}</dd>
						</div>
						<div class="grid gap-1">
							<dt class="text-muted-foreground">{m.posts_field_meta_title()}</dt>
							<dd>{review.pending.metaTitle ?? ''}</dd>
						</div>
						<div class="grid gap-1">
							<dt class="text-muted-foreground">
								{m.posts_field_meta_description()}
							</dt>
							<dd>{review.pending.metaDescription ?? ''}</dd>
						</div>
					</dl>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title><h2 class="font-semibold">{m.reviews_decision()}</h2></Card.Title>
				</Card.Header>
				<Card.Content class="grid gap-4">
					<form method="POST" action="?/approve">
						<input type="hidden" name="revisionId" value={review.pending.id} />
						<Button type="submit">{m.reviews_approve()}</Button>
					</form>
					<form method="POST" action="?/reject" class="grid gap-2">
						<input type="hidden" name="revisionId" value={review.pending.id} />
						<Label for="review-note">{m.reviews_note_label()}</Label>
						<Textarea
							id="review-note"
							name="note"
							rows={4}
							maxlength={MAX_NOTE_LENGTH}
							required
						/>
						<p class="text-xs text-muted-foreground">{m.reviews_note_hint()}</p>
						<div>
							<Button type="submit" variant="destructive">{m.reviews_reject()}</Button
							>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		</aside>
	</div>
</section>
