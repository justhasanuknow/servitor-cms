<script lang="ts">
	import { enhance } from '$app/forms';
	import BackupCodes from '$lib/components/backup-codes.svelte';
	import QrCode from '$lib/components/qr-code.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps, SubmitFunction } from './$types';

	let { data, form }: PageProps = $props();

	let submitting = $state(false);

	const enrollment = $derived.by(() => {
		if (form && 'enrollment' in form) {
			return form.enrollment;
		}

		return null;
	});

	const regeneratedCodes = $derived.by(() => {
		if (form && 'backupCodes' in form) {
			return form.backupCodes;
		}

		return null;
	});

	const successMessage = $derived.by(() => {
		if (!form || !('success' in form)) {
			return null;
		}

		if (form.action === 'confirm') {
			return m.two_factor_enabled();
		}

		return m.two_factor_disabled();
	});

	function errorFor(action: 'enable' | 'confirm' | 'disable' | 'regenerate'): string | null {
		if (!form || !('error' in form) || form.action !== action) {
			return null;
		}

		switch (form.error) {
			case 'already_enabled':
				return m.two_factor_already_on();
			case 'not_started':
				return m.two_factor_not_started();
			case 'not_enabled':
				return m.two_factor_status_off();
			default:
				return reauthenticationMessage(form.error);
		}
	}

	const submit: SubmitFunction = () => {
		submitting = true;

		return async ({ update }) => {
			await update();
			submitting = false;
		};
	};
</script>

<svelte:head>
	<title>{m.two_factor_title()} · {m.app_name()}</title>
</svelte:head>
{#snippet errorAlert(message: string | null)}
	{#if message}
		<Alert.Root variant="destructive">
			<Alert.Description>{message}</Alert.Description>
		</Alert.Root>
	{/if}
{/snippet}
{#snippet reauthenticationFields(prefix: string)}
	<div class="grid gap-2">
		<Label for="{prefix}-password">{m.common_password()}</Label>
		<Input
			id="{prefix}-password"
			name="password"
			type="password"
			autocomplete="current-password"
			maxlength={1024}
			required
		/>
	</div>
	<div class="grid gap-2">
		<Label for="{prefix}-code">{m.common_authentication_code()}</Label>
		<Input
			id="{prefix}-code"
			name="totpCode"
			inputmode="numeric"
			autocomplete="one-time-code"
			maxlength={16}
			required
		/>
	</div>
{/snippet}
<Card.Root>
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.two_factor_title()}</h1>
		</Card.Title>
		<Card.Description>{m.two_factor_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-6">
		{#if data.required}
			<Alert.Root>
				<Alert.Description>{m.two_factor_required_notice()}</Alert.Description>
			</Alert.Root>
		{/if}
		{#if successMessage}
			<Alert.Root>
				<Alert.Description>{successMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		{#if data.enabled}
			<div class="grid gap-1">
				<p class="font-medium">{m.two_factor_status_on()}</p>
				{#if data.backupCodesRemaining !== null}
					<p class="text-sm text-muted-foreground">
						{m.two_factor_backup_codes_remaining({
							count: String(data.backupCodesRemaining)
						})}
					</p>
				{/if}
			</div>
			{#if regeneratedCodes}
				<BackupCodes codes={regeneratedCodes} />
			{/if}
			<section class="grid gap-4 border-t pt-6">
				<div class="grid gap-1">
					<h2 class="font-medium">{m.two_factor_regenerate_title()}</h2>
					<p class="text-sm text-muted-foreground">
						{m.two_factor_regenerate_description()}
					</p>
				</div>
				{@render errorAlert(errorFor('regenerate'))}
				<form
					method="POST"
					action="?/regenerate"
					class="grid max-w-md gap-4"
					use:enhance={submit}
				>
					{@render reauthenticationFields('regenerate')}
					<div>
						<Button type="submit" variant="outline" disabled={submitting}>
							{m.two_factor_regenerate_submit()}
						</Button>
					</div>
				</form>
			</section>
			<section class="grid gap-4 border-t pt-6">
				<div class="grid gap-1">
					<h2 class="font-medium">{m.two_factor_disable_title()}</h2>
					<p class="text-sm text-muted-foreground">
						{m.two_factor_disable_description()}
					</p>
				</div>
				{@render errorAlert(errorFor('disable'))}
				<form
					method="POST"
					action="?/disable"
					class="grid max-w-md gap-4"
					use:enhance={submit}
				>
					{@render reauthenticationFields('disable')}
					<div>
						<Button type="submit" variant="destructive" disabled={submitting}>
							{m.two_factor_disable_submit()}
						</Button>
					</div>
				</form>
			</section>
		{:else}
			<p class="font-medium">{m.two_factor_status_off()}</p>
			{#if enrollment}
				<section class="grid gap-4">
					<p class="text-sm text-muted-foreground">{m.two_factor_scan()}</p>
					<QrCode shape={enrollment.qrCode} label={m.two_factor_qr_label()} />
					<div class="grid gap-1">
						<p class="text-sm font-medium">{m.two_factor_setup_key()}</p>
						<code
							class="w-fit rounded-xl bg-muted px-3 py-1.5 font-mono text-sm break-all"
							data-testid="totp-secret"
						>
							{enrollment.secret}
						</code>
					</div>
					<BackupCodes codes={enrollment.backupCodes} />
				</section>
			{/if}
			{#if data.pending || enrollment}
				<section class="grid gap-4">
					{#if !enrollment}
						<p class="text-sm text-muted-foreground">
							{m.two_factor_pending_description()}
						</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						{m.two_factor_confirm_description()}
					</p>
					{@render errorAlert(errorFor('confirm'))}
					<form
						method="POST"
						action="?/confirm"
						class="grid max-w-md gap-4"
						use:enhance={submit}
					>
						<div class="grid gap-2">
							<Label for="confirm-code">{m.common_authentication_code()}</Label>
							<Input
								id="confirm-code"
								name="code"
								inputmode="numeric"
								autocomplete="one-time-code"
								maxlength={16}
								required
							/>
						</div>
						<div>
							<Button type="submit" disabled={submitting}
								>{m.two_factor_confirm_submit()}</Button
							>
						</div>
					</form>
				</section>
			{/if}
			<section class="grid gap-4 border-t pt-6">
				<p class="text-sm text-muted-foreground">{m.two_factor_start_description()}</p>
				{@render errorAlert(errorFor('enable'))}
				<form
					method="POST"
					action="?/enable"
					class="grid max-w-md gap-4"
					use:enhance={submit}
				>
					<div class="grid gap-2">
						<Label for="enable-password">{m.common_password()}</Label>
						<Input
							id="enable-password"
							name="password"
							type="password"
							autocomplete="current-password"
							maxlength={1024}
							required
						/>
					</div>
					<div>
						{#if data.pending || enrollment}
							<Button type="submit" variant="outline" disabled={submitting}>
								{m.two_factor_restart_submit()}
							</Button>
						{:else}
							<Button type="submit" disabled={submitting}
								>{m.two_factor_start_submit()}</Button
							>
						{/if}
					</div>
				</form>
			</section>
		{/if}
	</Card.Content>
</Card.Root>
