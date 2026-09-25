<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CopyField from '$lib/components/copy-field.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import NativeSelect from '$lib/components/native-select.svelte';
	import PasswordInput from '$lib/components/password-input.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { MANAGED_ROLES } from '$lib/constants/users';
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { roleLabel, userStatusLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const target = $derived(data.target);

	const roleOptions = $derived(
		MANAGED_ROLES.map((role) => ({ value: role, label: roleLabel(role) }))
	);

	const createdLink = $derived.by(() => {
		if (form && 'link' in form && form.link) {
			return form.link;
		}

		return null;
	});

	const emailNotice = $derived.by(() => {
		if (!form || !('email' in form)) {
			return null;
		}

		if (form.email === 'sent') {
			return m.user_link_emailed({ email: target.email });
		}

		if (form.email === 'failed') {
			return m.user_link_email_failed();
		}

		return null;
	});

	const statusMessage = $derived.by(() => {
		if (!form || 'error' in form) {
			return null;
		}

		switch (form.action) {
			case 'setActive':
				if ('active' in form && form.active) {
					return m.user_reactivated();
				}

				return m.user_deactivated();
			case 'setPublishDirectly':
				return m.user_publish_changed();
			case 'changeRole':
				return m.user_role_changed();
			case 'passwordResetLink':
				return m.user_reset_created();
			default:
				return m.user_invite_created();
		}
	});

	function errorFor(action: string): string | null {
		if (!form || !('error' in form) || form.action !== action) {
			return null;
		}

		if (form.error === 'not_applicable') {
			return m.user_not_applicable();
		}

		return reauthenticationMessage(form.error);
	}
</script>

<svelte:head>
	<title>{target.name} · {m.app_name()}</title>
</svelte:head>
{#snippet errorAlert(message: string | null)}
	{#if message}
		<Alert.Root variant="destructive">
			<Alert.Description>{message}</Alert.Description>
		</Alert.Root>
	{/if}
{/snippet}
<section class="grid gap-6">
	<div class="grid gap-2">
		<a
			href={resolve('/panel/users')}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.user_back()}
		</a>
		<h1 class="text-2xl font-semibold">{target.name}</h1>
		<p class="break-all text-muted-foreground">{target.email}</p>
	</div>
	{#if statusMessage}
		<Alert.Root>
			<Alert.Description class="grid gap-3">
				<p>{statusMessage}</p>
				{#if emailNotice !== null}
					<p>{emailNotice}</p>
				{/if}
				{#if createdLink}
					<CopyField
						id="account-link"
						label={m.common_one_time_link()}
						value={createdLink}
					/>
				{/if}
			</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content>
			<dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
				<dt class="text-muted-foreground">{m.users_column_role()}</dt>
				<dd>{roleLabel(target.role)}</dd>
				<dt class="text-muted-foreground">{m.users_column_status()}</dt>
				<dd>{userStatusLabel(target.status)}</dd>
				<dt class="text-muted-foreground">{m.users_column_publishing()}</dt>
				<dd>
					{#if target.role !== 'author' || target.canPublishDirectly}
						{m.users_publish_direct()}
					{:else}
						{m.users_publish_review()}
					{/if}
				</dd>
				<dt class="text-muted-foreground">{m.nav_two_factor()}</dt>
				<dd>
					{#if target.twoFactorEnabled}
						{m.common_on()}
					{:else}
						{m.common_off()}
					{/if}
				</dd>
				<dt class="text-muted-foreground">{m.user_created()}</dt>
				<dd><FormattedDate value={target.createdAt} /></dd>
			</dl>
		</Card.Content>
	</Card.Root>
	{#if data.permissions.inviteLink}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					<h2 class="font-semibold">{m.user_invite_title()}</h2>
				</Card.Title>
				<Card.Description>{m.user_invite_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				{@render errorAlert(errorFor('inviteLink'))}
				<form method="POST" action="?/inviteLink" use:enhance>
					<Button type="submit" variant="outline">{m.user_invite_submit()}</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
	{#if data.permissions.passwordResetLink}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					<h2 class="font-semibold">{m.user_reset_title()}</h2>
				</Card.Title>
				<Card.Description>{m.user_reset_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				{@render errorAlert(errorFor('passwordResetLink'))}
				<form method="POST" action="?/passwordResetLink" use:enhance>
					<Button type="submit" variant="outline">{m.user_reset_submit()}</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
	{#if data.permissions.setPublishDirectly}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					<h2 class="font-semibold">{m.user_publish_title()}</h2>
				</Card.Title>
				<Card.Description>{m.user_publish_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				{@render errorAlert(errorFor('setPublishDirectly'))}
				<form method="POST" action="?/setPublishDirectly" use:enhance>
					{#if target.canPublishDirectly}
						<input type="hidden" name="value" value="false" />
						<Button type="submit" variant="outline">{m.user_publish_revoke()}</Button>
					{:else}
						<input type="hidden" name="value" value="true" />
						<Button type="submit" variant="outline">{m.user_publish_grant()}</Button>
					{/if}
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
	{#if data.permissions.changeRole}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					<h2 class="font-semibold">{m.user_role_title()}</h2>
				</Card.Title>
				<Card.Description>{m.user_role_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				{@render errorAlert(errorFor('changeRole'))}
				<form method="POST" action="?/changeRole" class="grid max-w-md gap-4" use:enhance>
					<div class="grid gap-2">
						<Label for="role">{m.users_column_role()}</Label>
						<NativeSelect
							id="role"
							name="role"
							options={roleOptions}
							value={target.role}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="role-password">{m.common_password()}</Label>
						<PasswordInput
							id="role-password"
							name="password"
							autocomplete="current-password"
							maxlength={1024}
							required
						/>
						<p class="text-sm text-muted-foreground">{m.reauth_password_hint()}</p>
					</div>
					{#if data.actorTwoFactorEnabled}
						<div class="grid gap-2">
							<Label for="role-code">{m.common_authentication_code()}</Label>
							<Input
								id="role-code"
								name="totpCode"
								inputmode="numeric"
								autocomplete="one-time-code"
								maxlength={16}
								required
							/>
						</div>
					{/if}
					<div>
						<Button type="submit">{m.user_role_submit()}</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
	{#if data.permissions.setActive}
		<Card.Root>
			{#if target.status === 'deactivated'}
				<Card.Header>
					<Card.Title>
						<h2 class="font-semibold">{m.user_reactivate_title()}</h2>
					</Card.Title>
					<Card.Description>{m.user_reactivate_description()}</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-4">
					{@render errorAlert(errorFor('setActive'))}
					<form method="POST" action="?/setActive" use:enhance>
						<input type="hidden" name="value" value="true" />
						<Button type="submit">{m.user_reactivate_submit()}</Button>
					</form>
				</Card.Content>
			{:else}
				<Card.Header>
					<Card.Title>
						<h2 class="font-semibold">{m.user_deactivate_title()}</h2>
					</Card.Title>
					<Card.Description>{m.user_deactivate_description()}</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-4">
					{@render errorAlert(errorFor('setActive'))}
					<form method="POST" action="?/setActive" use:enhance>
						<input type="hidden" name="value" value="false" />
						<Button type="submit" variant="destructive">
							{m.user_deactivate_submit()}
						</Button>
					</form>
				</Card.Content>
			{/if}
		</Card.Root>
	{/if}
</section>
