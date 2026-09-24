<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import * as Alert from '$lib/components/ui/alert';
	import * as Card from '$lib/components/ui/card';
	import { m } from '$lib/paraglide/messages';

	const POLL_MS = 1500;

	const SLOW_AFTER_MS = 3 * 60 * 1000;

	let slow = $state(false);

	async function healthy(): Promise<boolean> {
		try {
			return (await fetch(resolve('/healthz'), { cache: 'no-store' })).ok;
		} catch {
			return false;
		}
	}

	onMount(() => {
		const startedAt = Date.now();
		let wentDown = false;
		let stopped = false;

		const poll = async () => {
			if (stopped) {
				return;
			}

			if (!(await healthy())) {
				wentDown = true;
			} else if (wentDown) {
				window.location.assign(resolve('/panel/login'));

				return;
			}

			slow = Date.now() - startedAt > SLOW_AFTER_MS;
			setTimeout(poll, POLL_MS);
		};

		setTimeout(poll, POLL_MS);

		return () => {
			stopped = true;
		};
	});
</script>

<Card.Root data-testid="backup-restoring">
	<Card.Header>
		<Card.Title>
			<h2 class="flex items-center gap-2 font-semibold">
				<LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
				{m.backups_restoring_title()}
			</h2>
		</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<p aria-live="polite">{m.backups_restoring_description()}</p>
		{#if slow}
			<Alert.Root variant="destructive">
				<Alert.Description>{m.backups_restoring_slow()}</Alert.Description>
			</Alert.Root>
		{/if}
	</Card.Content>
</Card.Root>
