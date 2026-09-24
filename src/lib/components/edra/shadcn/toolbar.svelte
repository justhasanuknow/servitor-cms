<script lang="ts">
	import { Separator } from '$lib/components/ui/separator';
	import { m } from '$lib/paraglide/messages';
	import {
		blockCommands,
		blockTypeCommands,
		commandStatus,
		historyCommands,
		insertCommands,
		listCommands,
		markCommands,
		shortcutLabel
	} from '../commands';
	import type { EdraCommand } from '../commands.interfaces';
	import { isApplePlatform } from '../platform';
	import { getEditor, useEditorTransaction } from '../tiptap';
	import ColorMenu from './color-menu.svelte';
	import LinkPopover from './link-popover.svelte';
	import ToolbarButton from './toolbar-button.svelte';
	import type { ToolbarProps } from './toolbar.interfaces';

	let { actions }: ToolbarProps = $props();

	const editor = getEditor();
	const transaction = useEditorTransaction(editor);
	const apple = isApplePlatform();
	const groups = $derived([
		historyCommands(),
		blockTypeCommands(),
		markCommands(),
		blockCommands(),
		listCommands(),
		insertCommands(actions)
	]);
	const status = $derived(commandStatus(editor, groups.flat(), transaction.version));

	function shortcutOf(command: EdraCommand): string {
		if (command.shortcut === undefined) {
			return '';
		}

		return shortcutLabel(command.shortcut, apple);
	}
</script>

<div
	role="toolbar"
	aria-label={m.editor_toolbar()}
	class="flex flex-wrap items-center gap-0.5 border-b bg-background/95 p-1.5"
>
	{#each groups as group, index (index)}
		{#if index > 0}
			<Separator orientation="vertical" class="mx-1 h-5!" />
		{/if}
		{#each group as command (command.id)}
			<ToolbarButton
				label={command.label}
				shortcut={shortcutOf(command)}
				active={status.active.has(command.id)}
				disabled={status.disabled.has(command.id)}
				onclick={() => command.run(editor)}
			>
				<command.icon />
			</ToolbarButton>
		{/each}
		{#if index === 2}
			<LinkPopover />
			<ColorMenu />
		{/if}
	{/each}
</div>
