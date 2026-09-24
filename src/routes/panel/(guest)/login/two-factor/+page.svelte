<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { rateLimitMessage } from '$lib/i18n/auth-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps, SubmitFunction } from './$types';

	let { data, form }: PageProps = $props();

	let submitting = $state(false);

	const expired = $derived(!data.pending || form?.error === 'challenge_expired');

	const errorMessage = $derived.by(() => {
		if (!form) {
			return null;
		}

		switch (form.error) {
			case 'invalid_input':
				return m.common_invalid_input();
			case 'rate_limited':
				return rateLimitMessage(form.retryAfterSeconds);
			case 'locked':
				return m.login_two_factor_locked();
			case 'invalid_code':
				return m.login_two_factor_invalid_code();
			default:
				return null;
		}
	});

	const backupCodeOpen = $derived(form?.method === 'backup_code');

	const submit: SubmitFunction = () => {
		submitting = true;

		return async ({ update }) => {
			await update();
			submitting = false;
		};
	};
</script>

<svelte:head>
	<title>{m.login_two_factor_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root class="w-full max-w-sm">
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.login_two_factor_title()}</h1>
		</Card.Title>
		{#if !expired}
			<Card.Description>{m.login_two_factor_description()}</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content class="grid gap-6">
		{#if expired}
			<Alert.Root>
				<Alert.Description>{m.login_two_factor_expired()}</Alert.Description>
			</Alert.Root>
			<Button href={resolve('/panel/login')}>{m.login_back_to_sign_in()}</Button>
		{:else}
			{#if errorMessage}
				<Alert.Root variant="destructive">
					<Alert.Description>{errorMessage}</Alert.Description>
				</Alert.Root>
			{/if}
			<form method="POST" class="grid gap-4" use:enhance={submit}>
				<input type="hidden" name="method" value="totp" />
				<div class="grid gap-2">
					<Label for="totp-code">{m.common_authentication_code()}</Label>
					<Input
						id="totp-code"
						name="code"
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength={16}
						required
					/>
				</div>
				<Button type="submit" disabled={submitting}>{m.login_two_factor_submit()}</Button>
			</form>
			<details class="group grid gap-4" open={backupCodeOpen}>
				<summary
					class="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline"
				>
					{m.login_two_factor_use_backup_code()}
				</summary>
				<form method="POST" class="mt-4 grid gap-4" use:enhance={submit}>
					<input type="hidden" name="method" value="backup_code" />
					<p class="text-sm text-muted-foreground">
						{m.login_two_factor_backup_description()}
					</p>
					<div class="grid gap-2">
						<Label for="backup-code">{m.login_two_factor_backup_code()}</Label>
						<Input
							id="backup-code"
							name="code"
							autocomplete="off"
							maxlength={64}
							required
						/>
					</div>
					<Button type="submit" variant="outline" disabled={submitting}>
						{m.login_two_factor_submit()}
					</Button>
				</form>
			</details>
		{/if}
	</Card.Content>
	{#if !expired}
		<Card.Footer>
			<a
				href={resolve('/panel/login')}
				class="text-sm text-muted-foreground underline-offset-4 hover:underline"
			>
				{m.login_back_to_sign_in()}
			</a>
		</Card.Footer>
	{/if}
</Card.Root>
