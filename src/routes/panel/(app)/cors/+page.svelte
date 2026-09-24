<script lang="ts">
	import { enhance } from '$app/forms';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { corsErrorMessage } from '$lib/i18n/api-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return corsErrorMessage(form.error);
	});
	const changed = $derived.by(() => {
		if (!form || !('changed' in form)) {
			return null;
		}

		return form.changed;
	});
</script>

<svelte:head>
	<title>{m.cors_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.cors_title()}</h1>
		<p class="text-muted-foreground">{m.cors_description()}</p>
	</div>
	{#if changed === 'added'}
		<Alert.Root>
			<Alert.Description>{m.cors_added()}</Alert.Description>
		</Alert.Root>
	{:else if changed === 'removed'}
		<Alert.Root>
			<Alert.Description>{m.cors_removed()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content class="grid gap-6">
			<form method="POST" action="?/add" class="grid max-w-xl gap-2" use:enhance>
				<Label for="cors-origin">{m.cors_origin()}</Label>
				<div class="flex flex-wrap gap-2">
					<Input
						id="cors-origin"
						name="origin"
						type="url"
						maxlength={data.maxLength}
						placeholder="https://www.example.com"
						required
						class="min-w-64 flex-1"
					/>
					<Button type="submit">{m.cors_add()}</Button>
				</div>
				<p class="text-sm text-muted-foreground">{m.cors_origin_hint()}</p>
			</form>
			{#if data.origins.length === 0}
				<p class="text-sm text-muted-foreground">{m.cors_empty()}</p>
			{:else}
				<ul class="grid gap-3" data-testid="cors-origin-list">
					{#each data.origins as entry (entry.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
						>
							<div class="grid gap-1">
								<span class="font-mono text-sm">{entry.origin}</span>
								<span class="text-xs text-muted-foreground">
									{m.cors_added_by({ name: entry.createdByName })} ·
									<FormattedDate value={entry.createdAt} />
								</span>
							</div>
							<form method="POST" action="?/remove" use:enhance>
								<input type="hidden" name="id" value={entry.id} />
								<Button type="submit" variant="outline" size="sm"
									>{m.cors_remove()}</Button
								>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</section>
