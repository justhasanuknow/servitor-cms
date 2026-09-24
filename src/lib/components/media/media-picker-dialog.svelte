<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { MEDIA_THUMBNAIL_VARIANT, MEDIA_UPLOAD_ACCEPT } from '$lib/constants/media';
	import { mediaUrl } from '$lib/content/media-urls';
	import { mediaErrorMessage } from '$lib/i18n/media-messages';
	import type { MediaPickerItem } from '$lib/modules/interfaces/media.interfaces';
	import { m } from '$lib/paraglide/messages';
	import { isMediaPickerPage } from './media-picker';
	import type { MediaPickerDialogProps } from './media-picker-dialog.interfaces';

	let { open = $bindable(false), languageCode, onSelect }: MediaPickerDialogProps = $props();

	let items: MediaPickerItem[] = $state([]);
	let page = $state(1);
	let pageCount = $state(1);
	let loading = $state(false);
	let uploading = $state(false);
	let error: string | null = $state(null);
	let uploadForm: HTMLFormElement | undefined = $state();

	const uploadAction = `${resolve('/panel/media')}?/upload`;

	$effect(() => {
		if (open) {
			error = null;
			load(1, false);
		}
	});

	async function load(target: number, append: boolean): Promise<void> {
		loading = true;

		try {
			const query = new URLSearchParams({ page: String(target), language: languageCode });
			const response = await fetch(`${resolve('/panel/media/picker')}?${query.toString()}`);
			const body: unknown = await response.json();

			if (!response.ok || !isMediaPickerPage(body)) {
				error = m.media_error_generic();

				return;
			}

			if (append) {
				items = [...items, ...body.items];
			} else {
				items = body.items;
			}

			page = body.page;
			pageCount = body.pageCount;
		} catch {
			error = m.media_error_generic();
		} finally {
			loading = false;
		}
	}

	function errorCode(value: unknown): string | undefined {
		if (typeof value === 'string') {
			return value;
		}

		return undefined;
	}

	function choose(item: MediaPickerItem): void {
		onSelect(item);
		open = false;
	}

	function submitSelectedFile(): void {
		uploadForm?.requestSubmit();
	}

	const handleUpload: SubmitFunction = () => {
		uploading = true;
		error = null;

		return async ({ result, formElement }) => {
			uploading = false;
			formElement.reset();

			if (result.type === 'success') {
				await load(1, false);

				return;
			}

			if (result.type === 'failure') {
				error = mediaErrorMessage(errorCode(result.data?.error)) ?? m.media_error_generic();

				return;
			}

			error = m.media_error_generic();
		};
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>{m.media_picker_title()}</Dialog.Title>
			<Dialog.Description>{m.media_picker_description()}</Dialog.Description>
		</Dialog.Header>
		<form
			bind:this={uploadForm}
			method="POST"
			action={uploadAction}
			enctype="multipart/form-data"
			use:enhance={handleUpload}
			class="flex items-center gap-3"
		>
			<label
				class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
			>
				<Upload class="size-4" />
				<span>{m.media_upload_choose()}</span>
				<input
					type="file"
					name="file"
					accept={MEDIA_UPLOAD_ACCEPT}
					class="sr-only"
					disabled={uploading}
					onchange={submitSelectedFile}
				/>
			</label>
			{#if uploading}
				<span class="text-sm text-muted-foreground" role="status"
					>{m.media_uploading()}</span
				>
			{/if}
		</form>
		{#if error !== null}
			<Alert.Root variant="destructive">
				<Alert.Description>{error}</Alert.Description>
			</Alert.Root>
		{/if}
		<div class="max-h-[55vh] overflow-y-auto">
			{#if items.length === 0 && !loading}
				<p class="py-8 text-center text-sm text-muted-foreground">
					{m.media_picker_empty()}
				</p>
			{/if}
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each items as item (item.id)}
					<li>
						<button
							type="button"
							class="group block w-full overflow-hidden rounded-lg border bg-muted text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onclick={() => choose(item)}
						>
							<img
								src={mediaUrl(item.id, MEDIA_THUMBNAIL_VARIANT)}
								alt={item.alt}
								width={item.width}
								height={item.height}
								loading="lazy"
								class="aspect-square w-full object-cover transition-transform group-hover:scale-105"
							/>
							<span class="sr-only">{m.media_picker_insert()}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if page < pageCount}
				<div class="mt-4 flex justify-center">
					<Button
						variant="outline"
						disabled={loading}
						onclick={() => load(page + 1, true)}
					>
						{m.media_load_more()}
					</Button>
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
