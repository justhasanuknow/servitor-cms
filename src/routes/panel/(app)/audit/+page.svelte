<script lang="ts">
	import { resolve } from '$app/paths';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import NativeSelect from '$lib/components/native-select.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const actorOptions = $derived([
		{ value: '', label: m.audit_any() },
		{ value: 'system', label: m.audit_actor_system() },
		{ value: 'cli', label: m.audit_actor_cli() },
		{ value: 'anonymous', label: m.audit_actor_anonymous() },
		...data.actors.map((entry) => ({
			value: entry.id,
			label: `${entry.name} (${entry.email})`
		}))
	]);

	const actionOptions = $derived([
		{ value: '', label: m.audit_any() },
		...data.actions.map((action) => ({ value: action, label: action }))
	]);

	const activeFilters = $derived(
		Object.entries(data.filters).filter(([, value]) => value !== '')
	);

	function actorLabel(actorType: string, name: string | null, email: string | null): string {
		if (actorType === 'user' && name !== null) {
			return `${name} (${email ?? ''})`;
		}

		if (actorType === 'cli') {
			return m.audit_actor_cli();
		}

		if (actorType === 'anonymous') {
			return m.audit_actor_anonymous();
		}

		return m.audit_actor_system();
	}
</script>

<svelte:head>
	<title>{m.audit_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.audit_title()}</h1>
		<p class="text-muted-foreground">{m.audit_description()}</p>
	</div>
	<Card.Root>
		<Card.Content>
			<form method="GET" class="grid gap-4 md:grid-cols-3">
				<div class="grid gap-2">
					<Label for="filter-actor">{m.audit_column_actor()}</Label>
					<NativeSelect
						id="filter-actor"
						name="actor"
						options={actorOptions}
						value={data.filters.actor}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="filter-action">{m.audit_column_action()}</Label>
					<NativeSelect
						id="filter-action"
						name="action"
						options={actionOptions}
						value={data.filters.action}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="filter-target-type">{m.audit_filter_target_type()}</Label>
					<Input
						id="filter-target-type"
						name="targetType"
						maxlength={64}
						value={data.filters.targetType}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="filter-target-id">{m.audit_filter_target_id()}</Label>
					<Input
						id="filter-target-id"
						name="targetId"
						maxlength={128}
						value={data.filters.targetId}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="filter-from">{m.audit_filter_from()}</Label>
					<Input id="filter-from" name="from" type="date" value={data.filters.from} />
				</div>
				<div class="grid gap-2">
					<Label for="filter-to">{m.audit_filter_to()}</Label>
					<Input id="filter-to" name="to" type="date" value={data.filters.to} />
				</div>
				<div class="flex gap-2 md:col-span-3">
					<Button type="submit">{m.audit_filter_submit()}</Button>
					<Button href={resolve('/panel/audit')} variant="outline">
						{m.audit_filter_reset()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Content class="grid gap-4">
			{#if data.result.entries.length === 0}
				<p class="text-sm text-muted-foreground">{m.audit_empty()}</p>
			{:else}
				<ol class="grid gap-3" data-testid="audit-entries">
					{#each data.result.entries as entry (entry.id)}
						<li class="grid gap-2 rounded-2xl border p-4 text-sm">
							<div class="flex flex-wrap items-baseline justify-between gap-2">
								<code class="font-mono font-medium">{entry.action}</code>
								<span class="text-muted-foreground">
									<FormattedDate value={entry.createdAt} />
								</span>
							</div>
							<dl class="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
								<dt class="text-muted-foreground">{m.audit_column_actor()}</dt>
								<dd class="break-all">
									{actorLabel(entry.actorType, entry.actorName, entry.actorEmail)}
								</dd>
								{#if entry.targetType !== null}
									<dt class="text-muted-foreground">{m.audit_column_target()}</dt>
									<dd class="break-all">
										{entry.targetType}
										{entry.targetId ?? ''}
									</dd>
								{/if}
								{#if entry.ip !== null}
									<dt class="text-muted-foreground">{m.sessions_ip_address()}</dt>
									<dd>{entry.ip}</dd>
								{/if}
								{#if entry.userAgent !== null}
									<dt class="text-muted-foreground">{m.audit_user_agent()}</dt>
									<dd class="break-all">{entry.userAgent}</dd>
								{/if}
							</dl>
							{#if entry.details !== null}
								<details>
									<summary class="cursor-pointer text-muted-foreground">
										{m.audit_column_details()}
									</summary>
									<pre
										class="mt-2 overflow-x-auto rounded-xl bg-muted p-3 text-xs">{entry.details}</pre>
								</details>
							{/if}
						</li>
					{/each}
				</ol>
				<form
					method="GET"
					aria-label={m.audit_pagination()}
					class="flex items-center justify-between gap-4"
				>
					{#each activeFilters as [key, value] (key)}
						<input type="hidden" name={key} {value} />
					{/each}
					<Button
						type="submit"
						name="page"
						value={String(data.result.page - 1)}
						variant="outline"
						size="sm"
						disabled={data.result.page <= 1}
					>
						{m.audit_previous()}
					</Button>
					<span class="text-sm text-muted-foreground">
						{m.audit_page({
							page: String(data.result.page),
							total: String(data.result.pageCount)
						})}
					</span>
					<Button
						type="submit"
						name="page"
						value={String(data.result.page + 1)}
						variant="outline"
						size="sm"
						disabled={data.result.page >= data.result.pageCount}
					>
						{m.audit_next()}
					</Button>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>
</section>
