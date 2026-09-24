<script lang="ts">
	import { MEDIA_CONTENT_VARIANT } from '$lib/constants/media';
	import { PUBLIC_IMAGE_SIZES } from '$lib/constants/public';
	import { mediaSrcset, mediaUrl } from '$lib/content/media-urls';
	import { cn } from '$lib/utils';
	import type { PublicImageProps } from './public-image.interfaces';

	let { image, loading = 'lazy', class: className }: PublicImageProps = $props();
</script>

<img
	src={mediaUrl(image.id, MEDIA_CONTENT_VARIANT)}
	srcset={mediaSrcset(image.id, image.width)}
	sizes={PUBLIC_IMAGE_SIZES}
	width={image.width}
	height={image.height}
	alt={image.alt}
	{loading}
	decoding="async"
	class={cn('h-auto w-full rounded-2xl object-cover', className)}
/>
