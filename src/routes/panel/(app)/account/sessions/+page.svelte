<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmFields from '$lib/components/confirm-fields.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const otherSessions = $derived(data.sessions.filter((entry) => !entry.current));

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		if (form.error === 'not_found') {
			return m.sessions_not_found();
		}

		return reauthenticationMessage(form.error) ?? m.sessions_not_found();
	});

	const statusMessage = $derived.by(() => {
		if (!form || !('revoked' in form)) {
			return null;
		}

		if (form.revoked === 'others') {
			return m.sessions_revoked_others();
		}

		return m.sessions_revoked();
	});

	function deviceName(browser: string | null, os: string | null): string {
		if (browser !== null && os !== null) {
			return m.sessions_device({ browser, os });
		}

		return browser ?? os ?? m.sessions_unknown_device();
	}
</script>

<svelte:head>
	<title>{m.sessions_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root>
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.sessions_title()}</h1>
		</Card.Title>
		<Card.Description>{m.sessions_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-4">
		{#if errorMessage}
			<Alert.Root variant="destructive">
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		{#if statusMessage}
			<Alert.Root>
				<Alert.Description>{statusMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		<form method="POST" action="?/revokeOthers" class="grid gap-4" use:enhance>
			{#if otherSessions.length > 0}
				<ConfirmFields idPrefix="sessions" twoFactor={data.actorTwoFactorEnabled} />
				<Button type="submit" variant="destructive" class="justify-self-start">
					{m.sessions_revoke_others()}
				</Button>
			{:else}
				<p class="text-sm text-muted-foreground">{m.sessions_no_others()}</p>
			{/if}
			<ul class="grid gap-3" data-testid="session-list">
				{#each data.sessions as entry (entry.id)}
					<li
						class="flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-4"
					>
						<div class="grid gap-1">
							<p class="font-medium">
								{deviceName(entry.browser, entry.os)}
								{#if entry.current}
									<span
										class="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
									>
										{m.sessions_this_device()}
									</span>
								{/if}
							</p>
							<dl
								class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted-foreground"
							>
								<dt>{m.sessions_ip_address()}</dt>
								<dd>{entry.ipAddress ?? m.sessions_unknown_ip()}</dd>
								<dt>{m.sessions_signed_in()}</dt>
								<dd><FormattedDate value={entry.createdAt} /></dd>
								<dt>{m.sessions_last_active()}</dt>
								<dd><FormattedDate value={entry.lastActiveAt} /></dd>
							</dl>
						</div>
						{#if !entry.current}
							<Button
								type="submit"
								formaction="?/revoke"
								name="sessionId"
								value={entry.id}
								variant="outline"
								size="sm"
							>
								{m.sessions_revoke()}
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
		</form>
	</Card.Content>
</Card.Root>
