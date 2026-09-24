<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		if (form.error === 'rate_limited') {
			return m.common_rate_limited_generic();
		}

		return m.login_invalid_input();
	});
	const requested = $derived.by(() => {
		if (!form || !('requested' in form)) {
			return null;
		}

		return form.requested ?? null;
	});
</script>

<svelte:head>
	<title>{m.forgot_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root class="w-full max-w-sm">
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.forgot_title()}</h1>
		</Card.Title>
		<Card.Description>{m.forgot_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-4">
		{#if requested !== null}
			<Alert.Root>
				<Alert.Description>{m.forgot_requested({ email: requested })}</Alert.Description>
			</Alert.Root>
		{:else}
			<form method="POST" class="grid gap-4" use:enhance>
				{#if errorMessage !== null}
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
					/>
				</div>
				<Button type="submit">{m.forgot_submit()}</Button>
			</form>
		{/if}
		<a
			href={resolve('/panel/login')}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.forgot_back()}
		</a>
	</Card.Content>
</Card.Root>
