<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import type { PublicPaginationProps } from './public-pagination.interfaces';

	let { blogPath, page, pageCount }: PublicPaginationProps = $props();

	const newer = $derived.by(() => {
		if (page <= 1) {
			return null;
		}

		if (page === 2) {
			return blogPath;
		}

		return `${blogPath}?page=${page - 1}`;
	});
	const older = $derived.by(() => {
		if (page >= pageCount) {
			return null;
		}

		return `${blogPath}?page=${page + 1}`;
	});
</script>

{#if pageCount > 1}
	<nav
		aria-label={m.public_pagination()}
		class="flex items-center justify-between gap-4 border-t pt-6 text-sm"
	>
		<span>
			{#if newer !== null}
				<a
					href={resolve(`/blog/${newer}`)}
					rel="prev"
					class="underline-offset-4 hover:underline"
				>
					{m.public_newer()}
				</a>
			{/if}
		</span>
		<span class="text-muted-foreground">
			{m.pager_page({ page: String(page), total: String(pageCount) })}
		</span>
		<span>
			{#if older !== null}
				<a
					href={resolve(`/blog/${older}`)}
					rel="next"
					class="underline-offset-4 hover:underline"
				>
					{m.public_older()}
				</a>
			{/if}
		</span>
	</nav>
{/if}
