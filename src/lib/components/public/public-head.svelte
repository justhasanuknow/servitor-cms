<script lang="ts">
	import type { PublicHeadProps } from './public-head.interfaces';

	const STRUCTURED_DATA_TAG = 'script';

	let { seo }: PublicHeadProps = $props();

	const twitterCard = $derived.by(() => {
		if (seo.image === null) {
			return 'summary';
		}

		return 'summary_large_image';
	});
</script>

<svelte:head>
	<title>{seo.documentTitle}</title>
	{#if seo.description !== ''}
		<meta name="description" content={seo.description} />
	{/if}
	{#if seo.robots !== null}
		<meta name="robots" content={seo.robots} />
	{/if}
	<link rel="canonical" href={seo.canonical} />
	{#each seo.alternates as alternate (alternate.hreflang)}
		<link rel="alternate" hreflang={alternate.hreflang} href={alternate.href} />
	{/each}
	{#if seo.previous !== null}
		<link rel="prev" href={seo.previous} />
	{/if}
	{#if seo.next !== null}
		<link rel="next" href={seo.next} />
	{/if}
	{#if seo.feed !== null}
		<link
			rel="alternate"
			type="application/rss+xml"
			title={seo.feed.title}
			href={seo.feed.href}
		/>
	{/if}
	<meta property="og:type" content={seo.type} />
	<meta property="og:site_name" content={seo.siteName} />
	<meta property="og:title" content={seo.title} />
	<meta property="og:url" content={seo.canonical} />
	<meta property="og:locale" content={seo.locale} />
	{#if seo.description !== ''}
		<meta property="og:description" content={seo.description} />
	{/if}
	{#if seo.image !== null}
		<meta property="og:image" content={seo.image.url} />
		<meta property="og:image:width" content={String(seo.image.width)} />
		<meta property="og:image:height" content={String(seo.image.height)} />
		{#if seo.image.alt !== ''}
			<meta property="og:image:alt" content={seo.image.alt} />
		{/if}
	{/if}
	{#if seo.publishedTime !== null}
		<meta property="article:published_time" content={seo.publishedTime} />
	{/if}
	{#if seo.modifiedTime !== null}
		<meta property="article:modified_time" content={seo.modifiedTime} />
	{/if}
	<meta name="twitter:card" content={twitterCard} />
	<meta name="twitter:title" content={seo.title} />
	{#if seo.description !== ''}
		<meta name="twitter:description" content={seo.description} />
	{/if}
	{#if seo.image !== null}
		<meta name="twitter:image" content={seo.image.url} />
		{#if seo.image.alt !== ''}
			<meta name="twitter:image:alt" content={seo.image.alt} />
		{/if}
	{/if}
	{#if seo.jsonLd !== null}
		<svelte:element this={STRUCTURED_DATA_TAG} type="application/ld+json"
			>{seo.jsonLd}</svelte:element
		>
	{/if}
</svelte:head>
