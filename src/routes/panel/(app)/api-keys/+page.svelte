<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { enhance } from '$app/forms';
	import ConfirmFields from '$lib/components/confirm-fields.svelte';
	import CopyField from '$lib/components/copy-field.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { apiKeyErrorMessage, apiKeyStatusLabel } from '$lib/i18n/api-messages';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let allLanguages = $state(true);
	let allCategories = $state(true);
	let revokeTarget: string | null = $state(null);

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return apiKeyErrorMessage(form.error);
	});
	const created = $derived.by(() => {
		if (!form || !('created' in form)) {
			return null;
		}

		return form.created ?? null;
	});
	const revoked = $derived(form !== null && form !== undefined && 'revoked' in form);
	const revokeName = $derived(data.keys.find((key) => key.id === revokeTarget)?.name ?? '');
	const categoryNames = $derived(
		new Map(data.categories.map((category) => [category.id, category.name]))
	);

	function scopeText(values: string[] | null, names: Map<string, string> | null): string {
		if (values === null) {
			return m.api_keys_all();
		}

		return values.map((value) => names?.get(value) ?? value).join(', ');
	}
</script>

<svelte:head>
	<title>{m.api_keys_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.api_keys_title()}</h1>
		<p class="text-muted-foreground">{m.api_keys_description()}</p>
	</div>
	{#if created !== null}
		<Alert.Root>
			<Alert.Description class="grid gap-3">
				<p>{m.api_keys_created({ name: created.name })}</p>
				<CopyField
					id="created-api-key"
					label={m.api_keys_copy_label()}
					value={created.key}
				/>
			</Alert.Description>
		</Alert.Root>
	{/if}
	{#if revoked}
		<Alert.Root>
			<Alert.Description>{m.api_keys_revoked()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Header>
			<Card.Title><h2 class="font-semibold">{m.api_keys_create_title()}</h2></Card.Title>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/create" class="grid max-w-2xl gap-6" use:enhance>
				<div class="grid gap-2">
					<Label for="api-key-name">{m.api_keys_name()}</Label>
					<Input id="api-key-name" name="name" maxlength={data.limits.name} required />
					<p class="text-sm text-muted-foreground">{m.api_keys_name_hint()}</p>
				</div>
				<fieldset class="grid gap-3">
					<legend class="mb-2 text-sm font-medium">{m.api_keys_languages()}</legend>
					<label class="flex items-center gap-3 text-sm">
						<input
							type="checkbox"
							name="allLanguages"
							bind:checked={allLanguages}
							class="size-4 accent-primary"
						/>
						{m.api_keys_all_languages()}
					</label>
					{#if !allLanguages}
						<div class="flex flex-wrap gap-x-5 gap-y-2 pl-7">
							{#each data.languages as language (language.code)}
								<label class="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										name="languages"
										value={language.code}
										class="size-4 accent-primary"
									/>
									{language.name} ({language.code})
								</label>
							{/each}
						</div>
					{/if}
				</fieldset>
				<fieldset class="grid gap-3">
					<legend class="mb-2 text-sm font-medium">{m.api_keys_categories()}</legend>
					<label class="flex items-center gap-3 text-sm">
						<input
							type="checkbox"
							name="allCategories"
							bind:checked={allCategories}
							class="size-4 accent-primary"
						/>
						{m.api_keys_all_categories()}
					</label>
					{#if !allCategories}
						<div class="flex flex-wrap gap-x-5 gap-y-2 pl-7">
							{#each data.categories as category (category.id)}
								<label class="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										name="categories"
										value={category.id}
										class="size-4 accent-primary"
									/>
									{category.name}
								</label>
							{/each}
						</div>
					{/if}
					<p class="text-sm text-muted-foreground">{m.api_keys_scope_hint()}</p>
				</fieldset>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-2">
						<Label for="api-key-expires">{m.api_keys_expires()}</Label>
						<Input id="api-key-expires" name="expiresOn" type="date" />
					</div>
					<div class="grid gap-2">
						<Label for="api-key-rate-limit">{m.api_keys_rate_limit()}</Label>
						<Input
							id="api-key-rate-limit"
							name="rateLimit"
							type="number"
							min={data.limits.rateLimit.min}
							max={data.limits.rateLimit.max}
						/>
						<p class="text-sm text-muted-foreground">
							{m.api_keys_rate_limit_hint({ limit: String(data.defaultRateLimit) })}
						</p>
					</div>
				</div>
				<ConfirmFields idPrefix="api-key-create" twoFactor={data.actorTwoFactorEnabled} />
				<div>
					<Button type="submit">
						<KeyRound />
						{m.api_keys_create()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Title><h2 class="font-semibold">{m.api_keys_list_title()}</h2></Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.keys.length === 0}
				<p class="text-sm text-muted-foreground">{m.api_keys_empty()}</p>
			{:else}
				<ul class="grid gap-3" data-testid="api-key-list">
					{#each data.keys as key (key.id)}
						<li class="grid gap-2 rounded-2xl border p-4">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="grid gap-1">
									<span class="font-medium">{key.name}</span>
									<span class="font-mono text-xs text-muted-foreground"
										>{key.prefix}…</span
									>
								</div>
								<div class="flex items-center gap-3">
									<span
										class={cn(
											'rounded-full px-2 py-0.5 text-xs font-medium',
											key.status === 'active' &&
												'bg-primary text-primary-foreground',
											key.status !== 'active' &&
												'bg-muted text-muted-foreground'
										)}
									>
										{apiKeyStatusLabel(key.status)}
									</span>
									{#if key.status === 'active'}
										<Button
											variant="outline"
											size="sm"
											onclick={() => (revokeTarget = key.id)}
										>
											{m.api_keys_revoke()}
										</Button>
									{/if}
								</div>
							</div>
							<dl
								class="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2"
							>
								<div>
									<dt class="inline">{m.api_keys_languages()}:</dt>
									<dd class="inline">{scopeText(key.languages, null)}</dd>
								</div>
								<div>
									<dt class="inline">{m.api_keys_categories()}:</dt>
									<dd class="inline">
										{scopeText(key.categories, categoryNames)}
									</dd>
								</div>
								<div>
									<dt class="inline">{m.api_keys_last_used()}</dt>
									<dd class="inline">
										{#if key.lastUsedAt !== null}
											<FormattedDate value={key.lastUsedAt} />
										{:else}
											{m.api_keys_never_used()}
										{/if}
									</dd>
								</div>
								<div>
									<dt class="inline">{m.api_keys_expires_at()}</dt>
									<dd class="inline">
										{#if key.expiresAt !== null}
											<FormattedDate value={key.expiresAt} />
										{:else}
											{m.api_keys_no_expiry()}
										{/if}
									</dd>
								</div>
								<div>
									<dt class="sr-only">{m.api_keys_rate_limit()}</dt>
									<dd>
										{#if key.rateLimitPerMinute !== null}
											{m.api_keys_rate({
												limit: String(key.rateLimitPerMinute)
											})}
										{:else}
											{m.api_keys_default_rate()}
										{/if}
									</dd>
								</div>
								<div>
									<dt class="sr-only">
										{m.api_keys_created_by({ name: key.createdByName })}
									</dt>
									<dd>
										{m.api_keys_created_by({ name: key.createdByName })} ·
										<FormattedDate value={key.createdAt} />
									</dd>
								</div>
							</dl>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
</section>
<Dialog.Root
	open={revokeTarget !== null}
	onOpenChange={(open) => {
		if (!open) {
			revokeTarget = null;
		}
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.api_keys_revoke_title()}</Dialog.Title>
			<Dialog.Description>
				{revokeName}. {m.api_keys_revoke_description()}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/revoke"
			class="grid gap-4"
			use:enhance={() => {
				return async ({ update }) => {
					revokeTarget = null;
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={revokeTarget ?? ''} />
			<ConfirmFields idPrefix="api-key-revoke" twoFactor={data.actorTwoFactorEnabled} />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (revokeTarget = null)}>
					{m.common_cancel()}
				</Button>
				<Button type="submit" variant="destructive">{m.api_keys_revoke()}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
