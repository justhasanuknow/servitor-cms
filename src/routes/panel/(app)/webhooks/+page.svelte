<script lang="ts">
	import WebhookIcon from '@lucide/svelte/icons/webhook';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmFields from '$lib/components/confirm-fields.svelte';
	import CopyField from '$lib/components/copy-field.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import WebhookFields from '$lib/components/webhook-fields.svelte';
	import { webhookErrorMessage } from '$lib/i18n/webhook-messages';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return webhookErrorMessage(form.error);
	});
	const created = $derived.by(() => {
		if (!form || !('created' in form)) {
			return null;
		}

		return form.created ?? null;
	});
</script>

<svelte:head>
	<title>{m.webhooks_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.webhooks_title()}</h1>
		<p class="text-muted-foreground">{m.webhooks_description()}</p>
	</div>
	{#if created !== null}
		<Alert.Root>
			<Alert.Description class="grid gap-3">
				<p>{m.webhooks_created()}</p>
				<CopyField
					id="created-webhook-secret"
					label={m.webhooks_secret_label()}
					value={created.secret}
				/>
			</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content>
			{#if data.webhooks.length === 0}
				<p class="text-sm text-muted-foreground">{m.webhooks_empty()}</p>
			{:else}
				<ul class="grid gap-3" data-testid="webhook-list">
					{#each data.webhooks as webhook (webhook.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
						>
							<div class="grid min-w-0 gap-1">
								<a
									href={resolve(`/panel/webhooks/${webhook.id}`)}
									class="truncate font-mono text-sm font-medium underline-offset-4 hover:underline"
								>
									{webhook.url}
								</a>
								<span class="text-xs text-muted-foreground">
									{m.webhooks_created_by({ name: webhook.createdByName })} ·
									<FormattedDate value={webhook.createdAt} />
								</span>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs">
								{#if webhook.pendingCount > 0}
									<span class="rounded-full bg-secondary px-2 py-0.5">
										{m.webhooks_pending({
											count: String(webhook.pendingCount)
										})}
									</span>
								{/if}
								{#if webhook.failedCount > 0}
									<span
										class="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"
									>
										{m.webhooks_failed({ count: String(webhook.failedCount) })}
									</span>
								{/if}
								<span
									class={cn(
										'rounded-full px-2 py-0.5 font-medium',
										webhook.enabled && 'bg-primary text-primary-foreground',
										!webhook.enabled && 'bg-muted text-muted-foreground'
									)}
								>
									{#if webhook.enabled}
										{m.webhooks_status_enabled()}
									{:else}
										{m.webhooks_status_disabled()}
									{/if}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Title><h2 class="font-semibold">{m.webhooks_create_title()}</h2></Card.Title>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/create" class="grid max-w-2xl gap-6" use:enhance>
				<WebhookFields idPrefix="webhook-create" />
				<ConfirmFields idPrefix="webhook-create" twoFactor={data.actorTwoFactorEnabled} />
				<div>
					<Button type="submit">
						<WebhookIcon />
						{m.webhooks_create()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</section>
