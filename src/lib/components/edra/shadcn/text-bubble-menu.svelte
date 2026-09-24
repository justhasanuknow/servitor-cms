<script lang="ts">
	import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';
	import { isTextSelection } from '@tiptap/core';
	import { markCommands, shortcutLabel } from '../commands';
	import type { EdraCommand } from '../commands.interfaces';
	import { isApplePlatform } from '../platform';
	import { BubbleMenu, getEditor, useEditorState } from '../tiptap';
	import { bubbleOptions } from './bubble-options';
	import ColorMenu from './color-menu.svelte';
	import LinkPopover from './link-popover.svelte';
	import ToolbarButton from './toolbar-button.svelte';

	const HIDDEN_FOR = ['link', 'codeBlock', 'image', 'videoEmbed', 'inlineMath', 'blockMath'];

	const editor = getEditor();
	const commands = markCommands();
	const apple = isApplePlatform();
	const active = useEditorState(
		editor,
		(current) =>
			new Set(
				commands
					.filter((command) => command.isActive?.(current))
					.map((command) => command.id)
			)
	);

	const shouldShow: BubbleMenuPluginProps['shouldShow'] = ({ editor: current, view, state }) => {
		if (!current.isEditable || view.dragging) {
			return false;
		}

		if (HIDDEN_FOR.some((name) => current.isActive(name))) {
			return false;
		}

		const { selection, doc } = state;

		if (selection.empty || !isTextSelection(selection)) {
			return false;
		}

		return doc.textBetween(selection.from, selection.to).length > 0;
	};

	function shortcutOf(command: EdraCommand): string {
		if (command.shortcut === undefined) {
			return '';
		}

		return shortcutLabel(command.shortcut, apple);
	}
</script>

<BubbleMenu
	{editor}
	pluginKey="edra-text-bubble-menu"
	{shouldShow}
	options={bubbleOptions(editor)}
	class="flex items-center gap-0.5 rounded-xl border bg-popover p-1 shadow-md"
>
	{#each commands as command (command.id)}
		<ToolbarButton
			label={command.label}
			shortcut={shortcutOf(command)}
			active={active.current.has(command.id)}
			onclick={() => command.run(editor)}
		>
			<command.icon />
		</ToolbarButton>
	{/each}
	<LinkPopover />
	<ColorMenu />
</BubbleMenu>
