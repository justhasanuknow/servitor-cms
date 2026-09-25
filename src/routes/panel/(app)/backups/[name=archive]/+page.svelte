<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Download from '@lucide/svelte/icons/download';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import BackupRestoring from '$lib/components/backups/backup-restoring.svelte';
	import ConfirmFields from '$lib/components/confirm-fields.svelte';
	import PasswordInput from '$lib/components/password-input.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { archiveKindLabel, backupErrorMessage } from '$lib/i18n/backup-messages';
	import { formatByteSize, formatDateTimeUtc } from '$lib/i18n/format';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	const MAX_PASSPHRASE_LENGTH = 1024;

	let { data, form }: PageProps = $props();

	const archive = $derived(data.archive);
	const restoring = $derived(form !== null && form !== undefined && 'restoring' in form);
	const errorMessage = $derived.by(() => {
		if (form && 'error' in form) {
			let problem: string | undefined = undefined;

			if ('problem' in form) {
				problem = form.problem;
			}

			return backupErrorMessage(form.error, problem);
		}

		return backupErrorMessage(data.downloadError);
	});
	const title = $derived(m.backups_archive_title({ time: formatDateTimeUtc(archive.createdAt) }));
</script>

<svelte:head>
	<title>{title} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div>
		<Button href={resolve('/panel/backups')} variant="ghost" size="sm">
			<ArrowLeft />
			{m.backups_back()}
		</Button>
	</div>
	{#if restoring}
		<BackupRestoring />
	{:else}
		<div class="grid gap-3">
			<h1 class="text-2xl font-semibold">{title}</h1>
			<dl class="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
				<div>
					<dt class="inline">{m.backups_archive_file()}:</dt>
					<dd class="inline font-mono break-all" data-testid="backup-file">
						{archive.name}
					</dd>
				</div>
				<div>
					<dt class="inline">{m.backups_column_kind()}:</dt>
					<dd class="inline">{archiveKindLabel(archive.kind)}</dd>
				</div>
				<div>
					<dt class="inline">{m.backups_column_size()}:</dt>
					<dd class="inline">{formatByteSize(archive.size)}</dd>
				</div>
				<div>
					<dt class="inline">{m.backups_column_version()}:</dt>
					<dd class="inline">{archive.appVersion ?? m.backups_version_unknown()}</dd>
				</div>
			</dl>
		</div>
		{#if errorMessage !== null}
			<Alert.Root variant="destructive">
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.backups_download_title()}</h2></Card.Title>
				<Card.Description>{m.backups_download_description()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action={resolve('/panel/backups/download')}
					class="grid max-w-xl gap-6"
				>
					<input type="hidden" name="name" value={archive.name} />
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="grid gap-2">
							<Label for="download-passphrase"
								>{m.backups_download_passphrase()}</Label
							>
							<PasswordInput
								id="download-passphrase"
								toggleLabel={m.common_show_passphrase()}
								name="passphrase"
								autocomplete="new-password"
								maxlength={MAX_PASSPHRASE_LENGTH}
							/>
						</div>
						<div class="grid gap-2">
							<Label for="download-passphrase-confirmation">
								{m.backups_download_passphrase_confirm()}
							</Label>
							<PasswordInput
								id="download-passphrase-confirmation"
								toggleLabel={m.common_show_passphrase()}
								name="passphraseConfirmation"
								autocomplete="new-password"
								maxlength={MAX_PASSPHRASE_LENGTH}
							/>
						</div>
					</div>
					<p class="text-sm text-muted-foreground">
						{m.backups_download_passphrase_hint()}
					</p>
					<ConfirmFields idPrefix="backup-download" twoFactor={true} />
					<div>
						<Button type="submit">
							<Download />
							{m.backups_download_submit()}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.backups_restore_title()}</h2></Card.Title>
				<Card.Description>{m.backups_restore_description()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/restore" class="grid max-w-xl gap-6" use:enhance>
					<div class="grid gap-2">
						<Label for="restore-word">
							{m.backups_restore_confirm({ word: m.backups_restore_word() })}
						</Label>
						<Input
							id="restore-word"
							name="confirmWord"
							autocomplete="off"
							maxlength={100}
							required
						/>
					</div>
					<ConfirmFields idPrefix="backup-restore" twoFactor={true} />
					<div>
						<Button type="submit" variant="destructive">
							<RotateCcw />
							{m.backups_restore_submit()}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.backups_delete_title()}</h2></Card.Title>
				<Card.Description>{m.backups_delete_description()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/delete" class="grid max-w-xl gap-6" use:enhance>
					<ConfirmFields idPrefix="backup-delete" twoFactor={true} />
					<div>
						<Button type="submit" variant="destructive">
							<Trash2 />
							{m.backups_delete_submit()}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</section>
