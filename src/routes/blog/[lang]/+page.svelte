<script lang="ts">
	import PostList from '$lib/components/public/post-list.svelte';
	import PublicHead from '$lib/components/public/public-head.svelte';
	import PublicPagination from '$lib/components/public/public-pagination.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PublicHead seo={data.seo} />
<section class="grid gap-10">
	<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{data.siteName}</h1>
	<PostList posts={data.listing.items} />
	<PublicPagination
		blogPath={data.language.code}
		page={data.listing.page}
		pageCount={data.listing.pageCount}
	/>
</section>
