<script lang="ts">
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BackupUpload from '$lib/components/backups/backup-upload.svelte';
	import ConfirmFields from '$lib/components/confirm-fields.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import NativeSelect from '$lib/components/native-select.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		archiveKindLabel,
		backupErrorMessage,
		backupProblemMessage
	} from '$lib/i18n/backup-messages';
	import { formatByteSize, formatDateTimeUtc } from '$lib/i18n/format';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	const STATUS_POLL_MS = 2000;

	let { data, form }: PageProps = $props();

	const overview = $derived(data.overview);
	const running = $derived(overview.jobs.current !== null);
	const frequencyOptions = $derived([
		{ value: 'off', label: m.backups_schedule_off() },
		{ value: 'daily', label: m.backups_schedule_daily() },
		{ value: 'weekly', label: m.backups_schedule_weekly() }
	]);

	const restoreVariant = $derived.by(() => {
		if (overview.lastRestore?.status === 'failed') {
			return 'destructive' as const;
		}

		return 'default' as const;
	});

	const notice = $derived.by(() => {
		if (data.deleted) {
			return m.backups_deleted();
		}

		if (!form) {
			return null;
		}

		if ('created' in form) {
			return m.backups_create_started();
		}

		if ('schedule' in form && form.schedule === 'updated') {
			return m.backups_schedule_saved();
		}

		if ('schedule' in form) {
			return m.backups_schedule_unchanged();
		}

		return null;
	});

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return backupErrorMessage(form.error);
	});

	async function refreshWhenFinished(timer: ReturnType<typeof setInterval>) {
		const response = await fetch(resolve('/panel/backups/status'), { cache: 'no-store' }).catch(
			() => null
		);

		if (response === null || !response.ok) {
			return;
		}

		const status: unknown = await response.json().catch(() => null);

		if (
			typeof status === 'object' &&
			status !== null &&
			'running' in status &&
			!status.running
		) {
			clearInterval(timer);
			await invalidateAll();
		}
	}

	$effect(() => {
		if (!running) {
			return;
		}

		const timer = setInterval(() => void refreshWhenFinished(timer), STATUS_POLL_MS);

		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>{m.backups_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.backups_title()}</h1>
		<p class="text-muted-foreground">{m.backups_description()}</p>
	</div>
	{#if !overview.allowed}
		<Alert.Root variant="destructive" data-testid="backups-two-factor">
			<Alert.Description class="grid gap-3">
				<p>{m.backups_two_factor_required()}</p>
				<div>
					<Button href={resolve('/panel/account/two-factor')} variant="outline" size="sm">
						{m.backups_two_factor_link()}
					</Button>
				</div>
			</Alert.Description>
		</Alert.Root>
	{:else}
		{#if overview.lastRestore !== null}
			<Alert.Root variant={restoreVariant}>
				<Alert.Description>
					{#if overview.lastRestore.status === 'restored'}
						{m.backups_last_restored({
							archive: overview.lastRestore.archive,
							time: formatDateTimeUtc(new Date(overview.lastRestore.finishedAt))
						})}
					{:else}
						{m.backups_last_restore_failed({
							archive: overview.lastRestore.archive,
							time: formatDateTimeUtc(new Date(overview.lastRestore.finishedAt)),
							reason: backupProblemMessage(overview.lastRestore.problem)
						})}
					{/if}
				</Alert.Description>
			</Alert.Root>
		{/if}
		{#if notice !== null}
			<Alert.Root>
				<Alert.Description>{notice}</Alert.Description>
			</Alert.Root>
		{/if}
		{#if errorMessage !== null}
			<Alert.Root variant="destructive">
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{/if}
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.backups_create_title()}</h2></Card.Title>
				<Card.Description>{m.backups_create_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				{#if running}
					<p
						class="flex items-center gap-2 text-sm"
						aria-live="polite"
						data-testid="backup-job"
					>
						<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
						{m.backups_job_running()}
					</p>
				{:else if overview.jobs.last?.status === 'succeeded'}
					<p class="text-sm text-muted-foreground" data-testid="backup-job">
						{m.backups_job_succeeded({ archive: overview.jobs.last.archive ?? '' })}
					</p>
				{:else if overview.jobs.last?.status === 'failed'}
					<p class="text-sm text-destructive" data-testid="backup-job">
						{m.backups_job_failed({ error: overview.jobs.last.error ?? '' })}
					</p>
				{/if}
				<form method="POST" action="?/create" use:enhance>
					<Button type="submit" disabled={running}>
						<ArchiveRestore />
						{m.backups_create_submit()}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.backups_list_title()}</h2></Card.Title>
				<Card.Description>
					{m.backups_storage({
						free: formatByteSize(overview.storage.freeBytes),
						used: formatByteSize(overview.storage.archiveBytes)
					})}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if overview.archives.length === 0}
					<p class="text-sm text-muted-foreground">{m.backups_list_empty()}</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm" data-testid="backup-list">
							<thead class="text-left text-muted-foreground">
								<tr>
									<th class="py-2 pr-4 font-medium"
										>{m.backups_column_created()}</th
									>
									<th class="py-2 pr-4 font-medium">{m.backups_column_kind()}</th>
									<th class="py-2 pr-4 font-medium">{m.backups_column_size()}</th>
									<th class="py-2 pr-4 font-medium"
										>{m.backups_column_version()}</th
									>
									<th class="py-2 font-medium"
										><span class="sr-only">{m.backups_manage()}</span></th
									>
								</tr>
							</thead>
							<tbody>
								{#each overview.archives as archive (archive.name)}
									<tr class="border-t">
										<td class="py-2 pr-4"
											><FormattedDate value={archive.createdAt} /></td
										>
										<td class="py-2 pr-4">{archiveKindLabel(archive.kind)}</td>
										<td class="py-2 pr-4">{formatByteSize(archive.size)}</td>
										<td class="py-2 pr-4">
											{archive.appVersion ?? m.backups_version_unknown()}
										</td>
										<td class="py-2 text-right">
											<Button
												href={resolve(`/panel/backups/${archive.name}`)}
												variant="outline"
												size="sm"
											>
												{m.backups_manage()}
											</Button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.backups_upload_title()}</h2></Card.Title>
				<Card.Description>{m.backups_upload_description()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<BackupUpload
					chunkBytes={data.limits.chunkBytes}
					onUploaded={() => void invalidateAll()}
				/>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title><h2 class="font-semibold">{m.backups_schedule_title()}</h2></Card.Title>
				<Card.Description>{m.backups_schedule_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				{#if overview.nextScheduled !== null}
					<p class="text-sm" data-testid="backup-next">
						{m.backups_schedule_next({
							time: formatDateTimeUtc(overview.nextScheduled)
						})}
					</p>
				{/if}
				<form method="POST" action="?/schedule" class="grid max-w-xl gap-6" use:enhance>
					<div class="grid gap-4 sm:grid-cols-3">
						<div class="grid gap-2">
							<Label for="backup-frequency">{m.backups_schedule_frequency()}</Label>
							<NativeSelect
								id="backup-frequency"
								name="frequency"
								options={frequencyOptions}
								value={overview.schedule.frequency}
								required
							/>
						</div>
						<div class="grid gap-2">
							<Label for="backup-hour">{m.backups_schedule_hour()}</Label>
							<Input
								id="backup-hour"
								name="hour"
								type="number"
								min={data.limits.hour.min}
								max={data.limits.hour.max}
								value={String(overview.schedule.hour)}
								required
							/>
						</div>
						<div class="grid gap-2">
							<Label for="backup-retention">{m.backups_schedule_retention()}</Label>
							<Input
								id="backup-retention"
								name="retention"
								type="number"
								min={data.limits.retention.min}
								max={data.limits.retention.max}
								value={String(overview.schedule.retention)}
								required
							/>
						</div>
					</div>
					<ConfirmFields idPrefix="backup-schedule" twoFactor={true} />
					<div>
						<Button type="submit">{m.backups_schedule_submit()}</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</section>
