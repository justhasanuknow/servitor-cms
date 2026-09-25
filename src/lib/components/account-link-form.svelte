<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PasswordInput from '$lib/components/password-input.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { m } from '$lib/paraglide/messages';
	import type { AccountLinkFormProps } from './account-link-form.interfaces';

	let {
		title,
		description,
		submitLabel,
		completedMessage,
		completed,
		error
	}: AccountLinkFormProps = $props();
</script>

<svelte:head>
	<title>{title} · {m.app_name()}</title>
</svelte:head>
<Card.Root class="w-full max-w-sm">
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{title}</h1>
		</Card.Title>
		{#if description && !completed}
			<Card.Description>{description}</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content class="grid gap-4">
		{#if completed}
			<Alert.Root>
				<Alert.Description>{completedMessage}</Alert.Description>
			</Alert.Root>
			<Button href={resolve('/panel/login')}>{m.login_go_to_sign_in()}</Button>
		{:else if description === null}
			<Alert.Root>
				<Alert.Description>{m.link_invalid()}</Alert.Description>
			</Alert.Root>
			<Button href={resolve('/panel/login')} variant="outline">
				{m.login_go_to_sign_in()}
			</Button>
		{:else}
			{#if error}
				<Alert.Root variant="destructive">
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}
			<form method="POST" class="grid gap-4" use:enhance>
				<p class="text-sm text-muted-foreground">{m.password_description()}</p>
				<div class="grid gap-2">
					<Label for="new-password">{m.password_new()}</Label>
					<PasswordInput
						id="new-password"
						name="password"
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
						name="confirmation"
						autocomplete="new-password"
						minlength={12}
						maxlength={128}
						required
					/>
				</div>
				<Button type="submit">{submitLabel}</Button>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
