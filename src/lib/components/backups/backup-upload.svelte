<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { resolve } from '$app/paths';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { uploadErrorMessage } from '$lib/i18n/backup-messages';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type {
		BackupUploadProps,
		PendingUpload,
		UploadAnswer
	} from './backup-upload.interfaces';

	const RETRYABLE = new Set(['passphrase_required', 'wrong_passphrase']);

	let { chunkBytes, onUploaded }: BackupUploadProps = $props();

	let files: FileList | undefined = $state();
	let passphrase = $state('');
	let busy = $state(false);
	let progress: number | null = $state(null);
	let checking = $state(false);
	let uploaded: string | null = $state(null);
	let failure: string | null = $state(null);
	let pendingUpload: PendingUpload | null = $state(null);

	const percent = $derived.by(() => {
		if (progress === null) {
			return '';
		}

		return new Intl.NumberFormat(getLocale(), { style: 'percent' }).format(progress);
	});

	function field(body: object, key: string): string | undefined {
		const value: unknown = Reflect.get(body, key);

		if (value === undefined || value === null) {
			return undefined;
		}

		return String(value);
	}

	async function readAnswer(response: Response): Promise<UploadAnswer> {
		try {
			const body: unknown = await response.json();

			if (typeof body === 'object' && body !== null && 'status' in body) {
				return {
					status: String(body.status),
					id: field(body, 'id'),
					archive: field(body, 'archive'),
					problem: field(body, 'problem')
				};
			}
		} catch {
			return { status: 'failed' };
		}

		return { status: 'failed' };
	}

	async function send(file: File): Promise<UploadAnswer> {
		const started = await readAnswer(
			await fetch(resolve('/panel/backups/uploads'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ size: file.size })
			})
		);

		if (started.status !== 'started' || started.id === undefined) {
			return started;
		}

		for (let offset = 0; offset < file.size; offset += chunkBytes) {
			const response = await fetch(
				`${resolve(`/panel/backups/uploads/${started.id}`)}?offset=${offset}`,
				{
					method: 'PUT',
					headers: { 'content-type': 'application/octet-stream' },
					body: file.slice(offset, offset + chunkBytes)
				}
			);

			if (!response.ok) {
				return readAnswer(response);
			}

			progress = Math.min(1, (offset + chunkBytes) / file.size);
		}

		return { status: 'sent', id: started.id };
	}

	async function complete(id: string): Promise<UploadAnswer> {
		checking = true;

		try {
			return await readAnswer(
				await fetch(resolve(`/panel/backups/uploads/${id}/complete`), {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ passphrase })
				})
			);
		} finally {
			checking = false;
		}
	}

	async function upload(event: SubmitEvent) {
		event.preventDefault();

		const file = files?.item(0);

		if (!file || busy) {
			return;
		}

		busy = true;
		failure = null;
		uploaded = null;

		try {
			let id: string | undefined = undefined;

			if (pendingUpload !== null && pendingUpload.file === file) {
				id = pendingUpload.id;
			} else {
				progress = 0;

				const sent = await send(file);

				if (sent.status !== 'sent') {
					failure = uploadErrorMessage(sent.status, sent.problem);

					return;
				}

				id = sent.id;
			}

			if (id === undefined) {
				failure = uploadErrorMessage('failed');

				return;
			}

			const result = await complete(id);

			if (result.status === 'uploaded' && result.archive !== undefined) {
				uploaded = result.archive;
				pendingUpload = null;
				passphrase = '';
				onUploaded();

				return;
			}

			if (RETRYABLE.has(result.status)) {
				pendingUpload = { id, file };
			} else {
				pendingUpload = null;
			}

			failure = uploadErrorMessage(result.status, result.problem);
		} catch {
			failure = uploadErrorMessage('failed');
		} finally {
			busy = false;
			progress = null;
		}
	}
</script>

<form class="grid max-w-xl gap-4" onsubmit={upload}>
	<div class="grid gap-2">
		<Label for="backup-upload-file">{m.backups_upload_file()}</Label>
		<Input
			id="backup-upload-file"
			type="file"
			accept=".gz,.enc,application/gzip,application/octet-stream"
			bind:files
			required
		/>
	</div>
	<div class="grid gap-2">
		<Label for="backup-upload-passphrase">{m.backups_upload_passphrase()}</Label>
		<Input
			id="backup-upload-passphrase"
			type="password"
			autocomplete="off"
			maxlength={1024}
			bind:value={passphrase}
		/>
	</div>
	<noscript>
		<p class="text-sm text-muted-foreground">{m.backups_upload_needs_script()}</p>
	</noscript>
	{#if progress !== null}
		<div class="grid gap-2" aria-live="polite">
			<progress class="w-full" max="1" value={progress}></progress>
			<p class="text-sm text-muted-foreground">{m.backups_upload_progress({ percent })}</p>
		</div>
	{/if}
	{#if checking}
		<p class="text-sm text-muted-foreground" aria-live="polite">
			{m.backups_upload_checking()}
		</p>
	{/if}
	{#if uploaded !== null}
		<Alert.Root>
			<Alert.Description>{m.backups_upload_done({ archive: uploaded })}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if failure !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{failure}</Alert.Description>
		</Alert.Root>
	{/if}
	<div>
		<Button type="submit" disabled={busy}>
			<Upload />
			{m.backups_upload_submit()}
		</Button>
	</div>
</form>
