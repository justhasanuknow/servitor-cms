<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import Pager from '$lib/components/pager.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		MAX_MEDIA_ALT_TEXT_LENGTH,
		MEDIA_THUMBNAIL_VARIANT,
		MEDIA_UPLOAD_ACCEPT
	} from '$lib/constants/media';
	import { mediaUrl } from '$lib/content/media-urls';
	import { formatByteSize } from '$lib/i18n/format';
	import { mediaErrorMessage } from '$lib/i18n/media-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	type LibraryItem = PageProps['data']['library']['items'][number];

	let { data, form }: PageProps = $props();

	let uploading = $state(false);
	let altTarget: LibraryItem | null = $state(null);
	let deleteTarget: LibraryItem | null = $state(null);

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return mediaErrorMessage(form.error);
	});

	const altOpen = $derived(altTarget !== null);
	const deleteOpen = $derived(deleteTarget !== null);

	function altLabel(item: LibraryItem): string {
		if (data.defaultLanguage === null) {
			return '';
		}

		return item.altTexts[data.defaultLanguage] ?? '';
	}

	function closeAlt(open: boolean): void {
		if (!open) {
			altTarget = null;
		}
	}

	function closeDelete(open: boolean): void {
		if (!open) {
			deleteTarget = null;
		}
	}

	const handleUpload: SubmitFunction = () => {
		uploading = true;

		return async ({ update }) => {
			await update();
			uploading = false;
		};
	};

	const handleDialogSubmit: SubmitFunction = () => {
		return async ({ update }) => {
			await update();
			altTarget = null;
			deleteTarget = null;
		};
	};
</script>

<svelte:head>
	<title>{m.media_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.media_title()}</h1>
		<p class="text-muted-foreground">{m.media_description()}</p>
	</div>
	<Card.Root>
		<Card.Content class="grid gap-3">
			<form
				method="POST"
				action="?/upload"
				enctype="multipart/form-data"
				class="flex flex-wrap items-end gap-3"
				use:enhance={handleUpload}
			>
				<div class="grid gap-2">
					<Label for="media-file">{m.media_upload_label()}</Label>
					<Input
						id="media-file"
						name="file"
						type="file"
						accept={MEDIA_UPLOAD_ACCEPT}
						required
					/>
				</div>
				<Button type="submit" disabled={uploading}>
					<Upload />
					{m.media_upload_submit()}
				</Button>
				{#if uploading}
					<span class="text-sm text-muted-foreground" role="status"
						>{m.media_uploading()}</span
					>
				{/if}
			</form>
			<p class="text-xs text-muted-foreground">{m.media_upload_hint()}</p>
		</Card.Content>
	</Card.Root>
	{#if form && 'uploaded' in form}
		<Alert.Root>
			<Alert.Description>{m.media_uploaded()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if data.library.items.length === 0}
		<p class="text-sm text-muted-foreground">{m.media_empty()}</p>
	{:else}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="media-grid">
			{#each data.library.items as item (item.id)}
				<li class="grid gap-2 overflow-hidden rounded-2xl border bg-card p-2">
					<img
						src={mediaUrl(item.id, MEDIA_THUMBNAIL_VARIANT)}
						alt={altLabel(item)}
						width={item.width}
						height={item.height}
						loading="lazy"
						class="aspect-square w-full rounded-xl bg-muted object-cover"
					/>
					<div class="grid gap-0.5 px-1 text-xs text-muted-foreground">
						<span>{item.width} × {item.height} · {formatByteSize(item.byteSize)}</span>
						{#if item.inUse}
							<span>{m.media_in_use()}</span>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2 px-1 pb-1">
						<Button size="sm" variant="outline" onclick={() => (altTarget = item)}>
							{m.media_edit_alt()}
						</Button>
						<Button
							size="sm"
							variant="destructive"
							disabled={item.inUse}
							onclick={() => (deleteTarget = item)}
						>
							{m.media_delete()}
						</Button>
					</div>
				</li>
			{/each}
		</ul>
		<Pager
			page={data.library.page}
			pageCount={data.library.pageCount}
			label={m.media_title()}
		/>
	{/if}
</section>
<Dialog.Root open={altOpen} onOpenChange={closeAlt}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.media_alt_title()}</Dialog.Title>
			<Dialog.Description>{m.media_alt_description()}</Dialog.Description>
		</Dialog.Header>
		{#if altTarget !== null}
			<form
				method="POST"
				action="?/altTexts"
				class="grid gap-4"
				use:enhance={handleDialogSubmit}
			>
				<input type="hidden" name="id" value={altTarget.id} />
				{#each data.languages as language (language.code)}
					<div class="grid gap-2">
						<Label for={`alt-${language.code}`}>{language.nativeName}</Label>
						<Input
							id={`alt-${language.code}`}
							name={`alt:${language.code}`}
							value={altTarget.altTexts[language.code] ?? ''}
							maxlength={MAX_MEDIA_ALT_TEXT_LENGTH}
							lang={language.code}
						/>
					</div>
				{/each}
				<Dialog.Footer>
					<Button type="submit">{m.media_alt_save()}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
<Dialog.Root open={deleteOpen} onOpenChange={closeDelete}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.media_delete_title()}</Dialog.Title>
			<Dialog.Description>{m.media_delete_description()}</Dialog.Description>
		</Dialog.Header>
		{#if deleteTarget !== null}
			<form method="POST" action="?/delete" use:enhance={handleDialogSubmit}>
				<input type="hidden" name="id" value={deleteTarget.id} />
				<Dialog.Footer>
					<Button type="submit" variant="destructive">{m.media_delete_confirm()}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
