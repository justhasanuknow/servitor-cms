<script lang="ts">
	import { enhance } from '$app/forms';
	import NativeSelect from '$lib/components/native-select.svelte';
	import PasswordInput from '$lib/components/password-input.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const languageOptions = $derived(
		data.languages.map((language) => ({
			value: language.code,
			label: `${language.name} (${language.code})`
		}))
	);

	const statusMessage = $derived.by(() => {
		if (!form || !('result' in form)) {
			return null;
		}

		if (form.result === 'updated') {
			return m.settings_saved();
		}

		return m.settings_unchanged();
	});

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		if (form.error === 'unknown_language') {
			return m.settings_error_language();
		}

		return reauthenticationMessage(form.error);
	});
</script>

<svelte:head>
	<title>{m.settings_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root>
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.settings_title()}</h1>
		</Card.Title>
		<Card.Description>{m.settings_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-6">
		{#if statusMessage}
			<Alert.Root>
				<Alert.Description>{statusMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		{#if errorMessage}
			<Alert.Root variant="destructive">
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		<form method="POST" class="grid max-w-xl gap-6" use:enhance>
			<div class="grid gap-2">
				<Label for="site-name">{m.settings_site_name()}</Label>
				<Input
					id="site-name"
					name="siteName"
					maxlength={data.limits.siteName}
					required
					value={data.settings.siteName}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="default-language">{m.settings_default_language()}</Label>
				<NativeSelect
					id="default-language"
					name="defaultContentLanguage"
					options={languageOptions}
					value={data.settings.defaultContentLanguage}
					required
				/>
			</div>
			<label class="flex items-start gap-3 text-sm">
				<input
					type="checkbox"
					name="publicSiteEnabled"
					checked={data.settings.publicSiteEnabled}
					class="mt-0.5 size-4 accent-primary"
				/>
				<span class="grid gap-1">
					<span class="font-medium">{m.settings_public_site()}</span>
					<span class="text-muted-foreground">{m.settings_public_site_hint()}</span>
				</span>
			</label>
			<label class="flex items-start gap-3 text-sm">
				<input
					type="checkbox"
					name="requireTwoFactorForAdmins"
					checked={data.settings.requireTwoFactorForAdmins}
					class="mt-0.5 size-4 accent-primary"
				/>
				<span class="grid gap-1">
					<span class="font-medium">{m.settings_require_two_factor()}</span>
					<span class="text-muted-foreground">{m.settings_require_two_factor_hint()}</span
					>
				</span>
			</label>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="grid gap-2">
					<Label for="api-rate-limit">{m.settings_api_rate_limit()}</Label>
					<Input
						id="api-rate-limit"
						name="defaultApiRateLimit"
						type="number"
						min={data.limits.apiRateLimit.min}
						max={data.limits.apiRateLimit.max}
						required
						value={String(data.settings.defaultApiRateLimit)}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="revision-retention">{m.settings_revision_retention()}</Label>
					<Input
						id="revision-retention"
						name="revisionRetention"
						type="number"
						min={data.limits.revisionRetention.min}
						max={data.limits.revisionRetention.max}
						required
						value={String(data.settings.revisionRetention)}
					/>
				</div>
			</div>
			<fieldset class="grid gap-4 rounded-2xl border p-4">
				<legend class="px-1 text-sm font-medium">{m.settings_confirm_title()}</legend>
				<div class="grid gap-2">
					<Label for="settings-password">{m.common_password()}</Label>
					<PasswordInput
						id="settings-password"
						name="password"
						autocomplete="current-password"
						maxlength={1024}
						required
					/>
					<p class="text-sm text-muted-foreground">{m.reauth_password_hint()}</p>
				</div>
				{#if data.actorTwoFactorEnabled}
					<div class="grid gap-2">
						<Label for="settings-code">{m.common_authentication_code()}</Label>
						<Input
							id="settings-code"
							name="totpCode"
							inputmode="numeric"
							autocomplete="one-time-code"
							maxlength={16}
							required
						/>
					</div>
				{/if}
			</fieldset>
			<div>
				<Button type="submit">{m.settings_submit()}</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
