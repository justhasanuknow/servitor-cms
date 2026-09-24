<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CopyField from '$lib/components/copy-field.svelte';
	import NativeSelect from '$lib/components/native-select.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { roleLabel, userStatusLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const roleOptions = $derived(
		data.invitableRoles.map((role) => ({ value: role, label: roleLabel(role) }))
	);

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		if (form.error === 'email_taken') {
			return m.users_email_taken();
		}

		return reauthenticationMessage(form.error);
	});
</script>

<svelte:head>
	<title>{m.users_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.users_title()}</h1>
		<p class="text-muted-foreground">{m.users_description()}</p>
	</div>
	{#if form && 'invited' in form && form.invited}
		<Alert.Root>
			<Alert.Description class="grid gap-3">
				<p>{m.users_invite_created({ name: form.invited.name })}</p>
				{#if form.invited.email === 'sent'}
					<p>{m.user_link_emailed({ email: form.invited.address })}</p>
				{:else if form.invited.email === 'failed'}
					<p>{m.user_link_email_failed()}</p>
				{/if}
				<CopyField
					id="invite-link"
					label={m.common_one_time_link()}
					value={form.invited.link}
				/>
			</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content class="overflow-x-auto">
			<table class="w-full text-left text-sm" data-testid="user-table">
				<thead class="text-muted-foreground">
					<tr>
						<th class="py-2 pr-4 font-medium">{m.users_column_name()}</th>
						<th class="py-2 pr-4 font-medium">{m.common_email()}</th>
						<th class="py-2 pr-4 font-medium">{m.users_column_role()}</th>
						<th class="py-2 pr-4 font-medium">{m.users_column_status()}</th>
						<th class="py-2 font-medium">{m.users_column_publishing()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as entry (entry.id)}
						<tr class="border-t">
							<td class="py-2 pr-4">
								<a
									href={resolve(`/panel/users/${entry.id}`)}
									class="font-medium underline-offset-4 hover:underline"
								>
									{entry.name}
								</a>
							</td>
							<td class="py-2 pr-4 break-all">{entry.email}</td>
							<td class="py-2 pr-4">{roleLabel(entry.role)}</td>
							<td class="py-2 pr-4">{userStatusLabel(entry.status)}</td>
							<td class="py-2">
								{#if entry.role !== 'author' || entry.canPublishDirectly}
									{m.users_publish_direct()}
								{:else}
									{m.users_publish_review()}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</Card.Content>
	</Card.Root>
	{#if roleOptions.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					<h2 class="text-lg font-semibold">{m.users_invite_title()}</h2>
				</Card.Title>
				<Card.Description>{m.users_invite_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				{#if errorMessage}
					<Alert.Root variant="destructive">
						<Alert.Description>{errorMessage}</Alert.Description>
					</Alert.Root>
				{/if}
				<form method="POST" action="?/invite" class="grid max-w-md gap-4" use:enhance>
					<div class="grid gap-2">
						<Label for="invite-name">{m.users_field_name()}</Label>
						<Input id="invite-name" name="name" maxlength={100} required />
					</div>
					<div class="grid gap-2">
						<Label for="invite-email">{m.common_email()}</Label>
						<Input
							id="invite-email"
							name="email"
							type="email"
							maxlength={254}
							required
						/>
					</div>
					<div class="grid gap-2">
						<Label for="invite-role">{m.users_column_role()}</Label>
						<NativeSelect
							id="invite-role"
							name="role"
							options={roleOptions}
							value="author"
							required
						/>
					</div>
					<div>
						<Button type="submit">{m.users_invite_submit()}</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</section>
