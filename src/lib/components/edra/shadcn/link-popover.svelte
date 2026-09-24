<script lang="ts">
	import Link from '@lucide/svelte/icons/link-2';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import { isAllowedHref } from '$lib/content/links';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import { getEditor, useEditorState } from '../tiptap';

	const editor = getEditor();
	const active = useEditorState(editor, (current) => current.isActive('link'));

	let open = $state(false);
	let href = $state('');
	let invalid = $state(false);

	function currentHref(): string {
		const value: unknown = editor.getAttributes('link').href;

		if (typeof value === 'string') {
			return value;
		}

		return '';
	}

	function handleOpenChange(next: boolean): void {
		if (next) {
			href = currentHref();
			invalid = false;
		}
	}

	function keepSelection(event: MouseEvent): void {
		event.preventDefault();
	}

	function apply(event: SubmitEvent): void {
		event.preventDefault();

		const value = href.trim();

		if (!isAllowedHref(value)) {
			invalid = true;

			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
		open = false;
	}
</script>

<Popover.Root bind:open onOpenChange={handleOpenChange}>
	<Popover.Trigger
		class={cn(
			buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
			active.current && 'bg-muted text-primary'
		)}
		aria-label={m.editor_link()}
		title={m.editor_link()}
		onmousedown={keepSelection}
	>
		<Link />
	</Popover.Trigger>
	<Popover.Content class="w-80 gap-2 p-3">
		<form class="flex items-center gap-2" onsubmit={apply}>
			<Input
				bind:value={href}
				placeholder={m.editor_link_placeholder()}
				aria-label={m.editor_link_url()}
				aria-invalid={invalid}
				autocomplete="off"
			/>
			<Button type="submit" size="sm">{m.editor_link_apply()}</Button>
		</form>
		{#if invalid}
			<p class="text-xs text-destructive" role="alert">{m.editor_link_invalid()}</p>
		{/if}
	</Popover.Content>
</Popover.Root>
