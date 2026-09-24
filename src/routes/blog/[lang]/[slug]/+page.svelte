<script lang="ts">
	import PublicHead from '$lib/components/public/public-head.svelte';
	import PublicPost from '$lib/components/public/public-post.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PublicHead seo={data.seo} />
<PublicPost post={data.post} />
