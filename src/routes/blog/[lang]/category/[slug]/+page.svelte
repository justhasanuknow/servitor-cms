<script lang="ts">
	import PostList from '$lib/components/public/post-list.svelte';
	import PublicHead from '$lib/components/public/public-head.svelte';
	import PublicPagination from '$lib/components/public/public-pagination.svelte';
	import type { PageProps } from './$types';

	let { data, params }: PageProps = $props();
</script>

<PublicHead seo={data.seo} />
<section class="grid gap-10">
	<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{data.heading}</h1>
	<PostList posts={data.listing.items} />
	<PublicPagination
		blogPath={`${data.language.code}/category/${params.slug}`}
		page={data.listing.page}
		pageCount={data.listing.pageCount}
	/>
</section>
