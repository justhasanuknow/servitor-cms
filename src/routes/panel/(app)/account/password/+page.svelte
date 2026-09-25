<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PasswordInput from '$lib/components/password-input.svelte';
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

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		switch (form.error) {
			case 'too_short':
				return m.password_too_short();
			case 'too_long':
				return m.password_too_long();
			case 'too_common':
				return m.password_too_common();
			case 'too_predictable':
				return m.password_too_predictable();
			case 'reused':
				return m.password_reused();
			case 'mismatch':
				return m.password_mismatch();
			default:
				return reauthenticationMessage(form.error);
		}
	});

	const changed = $derived(form !== null && 'success' in form);

	const submit: SubmitFunction = () => {
		submitting = true;

		return async ({ update }) => {
			await update();
			submitting = false;
		};
	};
</script>

<svelte:head>
	<title>{m.password_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root>
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.password_title()}</h1>
		</Card.Title>
		<Card.Description>{m.password_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-4">
		{#if data.forced}
			<Alert.Root>
				<Alert.Description>{m.password_forced_notice()}</Alert.Description>
			</Alert.Root>
		{/if}
		{#if changed}
			<Alert.Root>
				<Alert.Description>{m.password_changed()}</Alert.Description>
			</Alert.Root>
			<div>
				<Button href={resolve('/panel')} variant="outline">{m.password_continue()}</Button>
			</div>
		{/if}
		{#if errorMessage}
			<Alert.Root variant="destructive">
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		<form method="POST" class="grid max-w-md gap-4" use:enhance={submit}>
			<div class="grid gap-2">
				<Label for="current-password">{m.password_current()}</Label>
				<PasswordInput
					id="current-password"
					name="currentPassword"
					autocomplete="current-password"
					maxlength={1024}
					required
				/>
			</div>
			<div class="grid gap-2">
				<Label for="new-password">{m.password_new()}</Label>
				<PasswordInput
					id="new-password"
					name="newPassword"
					autocomplete="new-password"
					minlength={12}
					maxlength={128}
					required
				/>
			</div>
			<div class="grid gap-2">
				<Label for="confirm-password">{m.password_confirm()}</Label>
				<PasswordInput
					id="confirm-password"
					name="confirmPassword"
					autocomplete="new-password"
					minlength={12}
					maxlength={128}
					required
				/>
			</div>
			{#if data.twoFactorEnabled}
				<div class="grid gap-2">
					<Label for="totp-code">{m.common_authentication_code()}</Label>
					<Input
						id="totp-code"
						name="totpCode"
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength={16}
						required
					/>
					<p class="text-sm text-muted-foreground">{m.reauth_code_hint()}</p>
				</div>
			{/if}
			<div>
				<Button type="submit" disabled={submitting}>{m.password_submit()}</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
