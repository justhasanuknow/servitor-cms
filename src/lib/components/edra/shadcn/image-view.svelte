<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { MAX_MEDIA_ALT_TEXT_LENGTH } from '$lib/constants/media';
	import { parseMediaUrl } from '$lib/content/media-urls';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import { NodeViewWrapper } from '../tiptap';
	import type { ImageViewProps } from './node-views.interfaces';

	let { editor, node, selected, updateAttributes }: ImageViewProps = $props();

	const inputId = `edra-image-alt-${crypto.randomUUID()}`;

	const src = $derived(mediaSource(node.attrs.src));
	const alt = $derived(textOf(node.attrs.alt));
	const width = $derived(numberOf(node.attrs.width));
	const height = $derived(numberOf(node.attrs.height));

	function mediaSource(value: unknown): string | null {
		if (typeof value === 'string' && parseMediaUrl(value) !== null) {
			return value;
		}

		return null;
	}

	function textOf(value: unknown): string {
		if (typeof value === 'string') {
			return value;
		}

		return '';
	}

	function numberOf(value: unknown): number | undefined {
		if (typeof value === 'number') {
			return value;
		}

		return undefined;
	}

	function updateAlt(event: Event & { currentTarget: HTMLInputElement }): void {
		updateAttributes({ alt: event.currentTarget.value.slice(0, MAX_MEDIA_ALT_TEXT_LENGTH) });
	}
</script>

<NodeViewWrapper class={cn('edra-image my-4 rounded-lg p-1', selected && 'ring-2 ring-primary')}>
	{#if src !== null}
		<img
			{src}
			{alt}
			{width}
			{height}
			class="mx-auto h-auto max-w-full rounded-md"
			draggable="false"
			data-drag-handle=""
		/>
	{/if}
	{#if selected && editor.isEditable}
		<div class="mt-2 flex items-center gap-2" contenteditable="false">
			<label for={inputId} class="shrink-0 text-xs text-muted-foreground">
				{m.editor_image_alt()}
			</label>
			<Input
				id={inputId}
				value={alt}
				maxlength={MAX_MEDIA_ALT_TEXT_LENGTH}
				class="h-8"
				oninput={updateAlt}
			/>
		</div>
	{/if}
</NodeViewWrapper>
