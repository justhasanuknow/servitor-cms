<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PasswordInput from '$lib/components/password-input.svelte';
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

	const errorMessage = $derived.by(() => {
		if (!form) {
			return null;
		}

		switch (form.error) {
			case 'invalid_input':
				return m.login_invalid_input();
			case 'rate_limited':
				return rateLimitMessage(form.retryAfterSeconds);
			case 'locked':
				return m.login_locked();
			default:
				return m.login_invalid_credentials();
		}
	});

	const submit: SubmitFunction = () => {
		submitting = true;

		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	};
</script>

<svelte:head>
	<title>{m.login_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root class="w-full max-w-sm">
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.login_title()}</h1>
		</Card.Title>
		<Card.Description>{m.login_description()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" class="grid gap-4" use:enhance={submit}>
			{#if errorMessage}
				<Alert.Root variant="destructive">
					<Alert.Description>{errorMessage}</Alert.Description>
				</Alert.Root>
			{/if}
			<div class="grid gap-2">
				<Label for="email">{m.common_email()}</Label>
				<Input
					id="email"
					name="email"
					type="email"
					autocomplete="username"
					maxlength={254}
					required
					value={form?.email ?? ''}
					aria-invalid={errorMessage !== null}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="password">{m.common_password()}</Label>
				<PasswordInput
					id="password"
					name="password"
					autocomplete="current-password"
					maxlength={1024}
					required
					aria-invalid={errorMessage !== null}
				/>
			</div>
			<Button type="submit" disabled={submitting}>{m.login_submit()}</Button>
		</form>
		{#if data.passwordResetByEmail}
			<a
				href={resolve('/panel/forgot-password')}
				class="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
			>
				{m.login_forgot()}
			</a>
		{/if}
	</Card.Content>
</Card.Root>
