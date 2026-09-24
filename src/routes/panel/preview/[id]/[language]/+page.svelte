<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import { resolve } from '$app/paths';
	import PublicHead from '$lib/components/public/public-head.svelte';
	import PublicPost from '$lib/components/public/public-post.svelte';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PublicHead seo={data.seo} />
<div class="flex min-h-dvh flex-col bg-background text-foreground">
	<div class="border-b bg-muted" role="status">
		<div
			class="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
		>
			<span class="inline-flex items-center gap-2 font-medium">
				<Eye class="size-4" aria-hidden="true" />
				{m.public_preview_notice()}
			</span>
			<a
				href={resolve(`/panel/posts/${data.post.postId}/${data.post.languageCode}`)}
				class="underline underline-offset-4"
			>
				{m.public_preview_back()}
			</a>
		</div>
	</div>
	<header class="border-b">
		<div class="mx-auto w-full max-w-3xl px-4 py-5 text-lg font-semibold tracking-tight">
			{data.siteName}
		</div>
	</header>
	<main class="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
		<PublicPost post={data.post} />
	</main>
</div>
