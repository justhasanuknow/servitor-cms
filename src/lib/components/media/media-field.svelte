<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import { Button } from '$lib/components/ui/button';
	import { MEDIA_THUMBNAIL_VARIANT } from '$lib/constants/media';
	import { mediaUrl } from '$lib/content/media-urls';
	import type { MediaPickerItem } from '$lib/modules/interfaces/media.interfaces';
	import { m } from '$lib/paraglide/messages';
	import type { MediaFieldProps } from './media-field.interfaces';
	import MediaPickerDialog from './media-picker-dialog.svelte';

	let {
		id,
		label,
		description,
		value = $bindable(null),
		languageCode,
		name,
		disabled = false,
		onChange
	}: MediaFieldProps = $props();

	let pickerOpen = $state(false);

	const hiddenValue = $derived(value?.id ?? '');

	function select(item: MediaPickerItem): void {
		value = { id: item.id, width: item.width, height: item.height };
		onChange?.(value);
	}

	function clear(): void {
		value = null;
		onChange?.(null);
	}
</script>

<div class="grid gap-2" role="group" aria-labelledby={`${id}-label`}>
	<span id={`${id}-label`} class="text-sm font-medium">{label}</span>
	{#if description}
		<p class="text-xs text-muted-foreground">{description}</p>
	{/if}
	{#if name}
		<input type="hidden" {name} value={hiddenValue} />
	{/if}
	{#if value !== null}
		<img
			src={mediaUrl(value.id, MEDIA_THUMBNAIL_VARIANT)}
			alt=""
			width={value.width}
			height={value.height}
			class="aspect-video w-full rounded-xl border bg-muted object-cover"
		/>
	{:else}
		<div
			class="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed text-muted-foreground"
		>
			<ImageIcon class="size-6" />
		</div>
	{/if}
	<div class="flex flex-wrap gap-2">
		<Button
			type="button"
			variant="outline"
			size="sm"
			{disabled}
			onclick={() => (pickerOpen = true)}
		>
			{m.media_field_choose()}
		</Button>
		{#if value !== null}
			<Button type="button" variant="ghost" size="sm" {disabled} onclick={clear}>
				{m.media_field_remove()}
			</Button>
		{/if}
	</div>
</div>
<MediaPickerDialog bind:open={pickerOpen} {languageCode} onSelect={select} />
