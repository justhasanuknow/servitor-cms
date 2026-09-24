<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { parseVideoUrl } from '$lib/content/video-embeds';
	import { m } from '$lib/paraglide/messages';
	import type { VideoEmbedDialogProps } from './video-embed-dialog.interfaces';

	let { open = $bindable(false), onInsert }: VideoEmbedDialogProps = $props();

	const inputId = `edra-video-url-${crypto.randomUUID()}`;

	let url = $state('');
	let invalid = $state(false);

	$effect(() => {
		if (open) {
			url = '';
			invalid = false;
		}
	});

	function insert(event: SubmitEvent): void {
		event.preventDefault();

		const reference = parseVideoUrl(url);

		if (reference === null) {
			invalid = true;

			return;
		}

		onInsert(reference);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.editor_video_title()}</Dialog.Title>
			<Dialog.Description>{m.editor_video_description()}</Dialog.Description>
		</Dialog.Header>
		<form class="grid gap-4" onsubmit={insert}>
			<div class="grid gap-2">
				<Label for={inputId}>{m.editor_video_url()}</Label>
				<Input
					id={inputId}
					bind:value={url}
					type="url"
					autocomplete="off"
					placeholder={m.editor_video_placeholder()}
					aria-invalid={invalid}
					aria-describedby={`${inputId}-error`}
				/>
				{#if invalid}
					<p id={`${inputId}-error`} class="text-sm text-destructive" role="alert">
						{m.editor_video_invalid()}
					</p>
				{/if}
			</div>
			<Dialog.Footer>
				<Button type="submit">{m.editor_video_insert()}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
