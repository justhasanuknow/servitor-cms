<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmFields from '$lib/components/confirm-fields.svelte';
	import CopyField from '$lib/components/copy-field.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import WebhookFields from '$lib/components/webhook-fields.svelte';
	import { deliveryStatusLabel, webhookErrorMessage } from '$lib/i18n/webhook-messages';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let deleteOpen = $state(false);

	const webhook = $derived(data.webhook);
	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return webhookErrorMessage(form.error);
	});
	const rotated = $derived.by(() => {
		if (!form || !('rotated' in form)) {
			return null;
		}

		return form.rotated ?? null;
	});
	const saved = $derived(form !== null && form !== undefined && 'saved' in form);
</script>

<svelte:head>
	<title>{m.webhooks_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-2">
		<a
			href={resolve('/panel/webhooks')}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.webhooks_back()}
		</a>
		<h1 class="font-mono text-xl font-semibold break-all">{webhook.url}</h1>
		<p class="text-sm text-muted-foreground">
			{m.webhooks_created_by({ name: webhook.createdByName })} ·
			<FormattedDate value={webhook.createdAt} />
		</p>
	</div>
	{#if saved}
		<Alert.Root>
			<Alert.Description>{m.webhooks_saved()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if rotated !== null}
		<Alert.Root>
			<Alert.Description class="grid gap-3">
				<p>{m.webhooks_rotated()}</p>
				<CopyField
					id="rotated-webhook-secret"
					label={m.webhooks_secret_label()}
					value={rotated}
				/>
			</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
		<Card.Root>
			<Card.Header>
				<Card.Title
					><h2 class="font-semibold">{m.webhooks_deliveries_title()}</h2></Card.Title
				>
			</Card.Header>
			<Card.Content>
				{#if data.deliveries.length === 0}
					<p class="text-sm text-muted-foreground">{m.webhooks_deliveries_empty()}</p>
				{:else}
					<ul class="grid gap-3" data-testid="webhook-deliveries">
						{#each data.deliveries as delivery (delivery.id)}
							<li class="grid gap-1 rounded-2xl border p-3 text-sm">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<code class="font-mono text-xs">{delivery.event}</code>
									<span
										class={cn(
											'rounded-full px-2 py-0.5 text-xs font-medium',
											delivery.status === 'succeeded' &&
												'bg-primary text-primary-foreground',
											delivery.status === 'failed' &&
												'bg-destructive/10 text-destructive',
											delivery.status !== 'succeeded' &&
												delivery.status !== 'failed' &&
												'bg-secondary text-secondary-foreground'
										)}
									>
										{deliveryStatusLabel(delivery.status)}
									</span>
								</div>
								<p
									class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
								>
									<FormattedDate value={delivery.createdAt} />
									<span
										>{m.webhooks_delivery_attempts({
											count: String(delivery.attemptCount)
										})}</span
									>
									{#if delivery.lastStatusCode !== null}
										<span
											>{m.webhooks_delivery_code({
												code: String(delivery.lastStatusCode)
											})}</span
										>
									{/if}
									{#if delivery.lastDurationMs !== null}
										<span>
											{m.webhooks_delivery_duration({
												ms: String(delivery.lastDurationMs)
											})}
										</span>
									{/if}
									{#if delivery.status === 'pending' && delivery.nextAttemptAt !== null && delivery.attemptCount > 0}
										<span>
											{m.webhooks_delivery_next()}
											<FormattedDate value={delivery.nextAttemptAt} />
										</span>
									{/if}
								</p>
								{#if delivery.lastError !== null}
									<p class="text-xs break-words text-destructive">
										{delivery.lastError}
									</p>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>
		<aside class="grid content-start gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title
						><h2 class="font-semibold">{m.webhooks_settings_title()}</h2></Card.Title
					>
				</Card.Header>
				<Card.Content>
					<form
						method="POST"
						action="?/update"
						class="grid gap-5"
						use:enhance={() => {
							return async ({ update }) => {
								await update({ reset: false });
							};
						}}
					>
						<WebhookFields
							idPrefix="webhook-edit"
							url={webhook.url}
							events={webhook.events}
							enabled={webhook.enabled}
						/>
						<div>
							<Button type="submit">{m.webhooks_save()}</Button>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title
						><h2 class="font-semibold">{m.webhooks_rotate_title()}</h2></Card.Title
					>
					<Card.Description>{m.webhooks_rotate_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST" action="?/rotate" class="grid gap-4" use:enhance>
						<p class="text-sm text-muted-foreground">
							{#if webhook.secretRotatedAt !== null}
								{m.webhooks_rotated_at()}
								<FormattedDate value={webhook.secretRotatedAt} />
							{:else}
								{m.webhooks_never_rotated()}
							{/if}
						</p>
						<ConfirmFields
							idPrefix="webhook-rotate"
							twoFactor={data.actorTwoFactorEnabled}
						/>
						<div>
							<Button type="submit" variant="outline">{m.webhooks_rotate()}</Button>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title
						><h2 class="font-semibold">{m.webhooks_delete_title()}</h2></Card.Title
					>
					<Card.Description>{m.webhooks_delete_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button variant="destructive" onclick={() => (deleteOpen = true)}>
						{m.webhooks_delete()}
					</Button>
				</Card.Content>
			</Card.Root>
		</aside>
	</div>
</section>
<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.webhooks_delete_confirm_title()}</Dialog.Title>
			<Dialog.Description>{m.webhooks_delete_confirm_description()}</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/delete">
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (deleteOpen = false)}>
					{m.common_cancel()}
				</Button>
				<Button type="submit" variant="destructive">{m.webhooks_delete()}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
