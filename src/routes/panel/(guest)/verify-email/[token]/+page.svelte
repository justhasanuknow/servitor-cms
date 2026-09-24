<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const changed = $derived(form !== null && form !== undefined && 'changed' in form);
	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		if (form.error === 'email_taken') {
			return m.profile_email_error_taken();
		}

		return m.verify_email_invalid();
	});
</script>

<svelte:head>
	<title>{m.verify_email_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root class="w-full max-w-sm">
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.verify_email_title()}</h1>
		</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		{#if changed}
			<Alert.Root>
				<Alert.Description>{m.verify_email_done()}</Alert.Description>
			</Alert.Root>
			<a href={resolve('/panel')} class="text-sm underline underline-offset-4">
				{m.verify_email_continue()}
			</a>
		{:else if data.change === null}
			<Alert.Root variant="destructive">
				<Alert.Description>{m.verify_email_invalid()}</Alert.Description>
			</Alert.Root>
		{:else}
			{#if errorMessage !== null}
				<Alert.Root variant="destructive">
					<Alert.Description>{errorMessage}</Alert.Description>
				</Alert.Root>
			{/if}
			<p class="text-sm">{m.verify_email_description({ email: data.change.newEmail })}</p>
			<form method="POST" use:enhance>
				<Button type="submit">{m.verify_email_submit()}</Button>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
