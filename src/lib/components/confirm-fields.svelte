<script lang="ts">
	import PasswordInput from '$lib/components/password-input.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { m } from '$lib/paraglide/messages';
	import type { ConfirmFieldsProps } from './confirm-fields.interfaces';

	const MAX_PASSWORD_LENGTH = 1024;

	const MAX_CODE_LENGTH = 16;

	let { idPrefix, twoFactor }: ConfirmFieldsProps = $props();
</script>

<fieldset class="grid gap-4 rounded-2xl border p-4">
	<legend class="px-1 text-sm font-medium">{m.settings_confirm_title()}</legend>
	<div class="grid gap-2">
		<Label for={`${idPrefix}-password`}>{m.common_password()}</Label>
		<PasswordInput
			id={`${idPrefix}-password`}
			name="password"
			autocomplete="current-password"
			maxlength={MAX_PASSWORD_LENGTH}
			required
		/>
		<p class="text-sm text-muted-foreground">{m.reauth_password_hint()}</p>
	</div>
	{#if twoFactor}
		<div class="grid gap-2">
			<Label for={`${idPrefix}-code`}>{m.common_authentication_code()}</Label>
			<Input
				id={`${idPrefix}-code`}
				name="totpCode"
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength={MAX_CODE_LENGTH}
				required
			/>
		</div>
	{/if}
</fieldset>
