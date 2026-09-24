<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { WEBHOOK_EVENTS, WEBHOOK_URL_MAX_LENGTH } from '$lib/constants/webhooks';
	import { webhookEventDescription } from '$lib/i18n/webhook-messages';
	import { m } from '$lib/paraglide/messages';
	import type { WebhookFieldsProps } from './webhook-fields.interfaces';

	let {
		idPrefix,
		url = '',
		events = [...WEBHOOK_EVENTS],
		enabled = true
	}: WebhookFieldsProps = $props();
</script>

<div class="grid gap-2">
	<Label for={`${idPrefix}-url`}>{m.webhooks_url()}</Label>
	<Input
		id={`${idPrefix}-url`}
		name="url"
		type="url"
		value={url}
		maxlength={WEBHOOK_URL_MAX_LENGTH}
		placeholder="https://build.example.com/hooks/servitor"
		required
	/>
	<p class="text-sm text-muted-foreground">{m.webhooks_url_hint()}</p>
</div>
<fieldset class="grid gap-2">
	<legend class="mb-2 text-sm font-medium">{m.webhooks_events()}</legend>
	{#each WEBHOOK_EVENTS as event (event)}
		<label class="flex items-start gap-3 text-sm">
			<input
				type="checkbox"
				name="events"
				value={event}
				checked={events.includes(event)}
				class="mt-0.5 size-4 accent-primary"
			/>
			<span class="grid gap-0.5">
				<code class="font-mono text-xs">{event}</code>
				<span class="text-muted-foreground">{webhookEventDescription(event)}</span>
			</span>
		</label>
	{/each}
</fieldset>
<label class="flex items-center gap-3 text-sm">
	<input type="checkbox" name="enabled" checked={enabled} class="size-4 accent-primary" />
	{m.webhooks_enabled()}
</label>
