<script lang="ts">
	import Video from '@lucide/svelte/icons/video';
	import {
		VIDEO_EMBED_ALLOW,
		VIDEO_EMBED_REFERRER_POLICY,
		VIDEO_EMBED_SANDBOX,
		VIDEO_PROVIDER_NAMES,
		videoEmbedUrl,
		videoReference
	} from '$lib/content/video-embeds';
	import { cn } from '$lib/utils';
	import { NodeViewWrapper } from '../tiptap';
	import type { VideoEmbedViewProps } from './node-views.interfaces';

	let { node, selected }: VideoEmbedViewProps = $props();

	const reference = $derived(videoReference(node.attrs.provider, node.attrs.videoId));
</script>

<NodeViewWrapper class={cn('edra-video my-4 rounded-lg p-1', selected && 'ring-2 ring-primary')}>
	{#if reference !== null}
		<div
			class="flex items-center gap-2 px-1 pb-1 text-xs text-muted-foreground"
			contenteditable="false"
			data-drag-handle=""
		>
			<Video class="size-3.5" />
			<span>{VIDEO_PROVIDER_NAMES[reference.provider]} · {reference.videoId}</span>
		</div>
		<div class="relative aspect-video overflow-hidden rounded-md border bg-muted">
			<iframe
				src={videoEmbedUrl(reference)}
				title={VIDEO_PROVIDER_NAMES[reference.provider]}
				loading="lazy"
				referrerpolicy={VIDEO_EMBED_REFERRER_POLICY}
				sandbox={VIDEO_EMBED_SANDBOX}
				allow={VIDEO_EMBED_ALLOW}
				class={cn('absolute inset-0 size-full', !selected && 'pointer-events-none')}
			></iframe>
		</div>
	{/if}
</NodeViewWrapper>
