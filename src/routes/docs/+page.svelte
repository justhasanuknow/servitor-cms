<script lang="ts">
	import DocsArticle from '$lib/components/docs/docs-article.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<DocsArticle view={data.view} />
