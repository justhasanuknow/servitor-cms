<script lang="ts">
	import { translationStatusLabel } from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { TranslationStatusBadgeProps } from './translation-status-badge.interfaces';

	let { status, pendingChanges = false }: TranslationStatusBadgeProps = $props();

	const changesPending = $derived(pendingChanges && status !== 'pending_review');

	const tone = $derived.by(() => {
		if (status === 'published') {
			return 'bg-primary text-primary-foreground';
		}

		if (status === 'pending_review' || status === 'scheduled') {
			return 'bg-secondary text-secondary-foreground ring-1 ring-border';
		}

		return 'bg-muted text-muted-foreground';
	});
</script>

<span class="inline-flex flex-wrap items-center gap-1">
	<span class={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone)}>
		{translationStatusLabel(status)}
	</span>
	{#if changesPending}
		<span
			class="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground ring-1 ring-border"
		>
			{m.post_status_changes_pending()}
		</span>
	{/if}
</span>
