<script lang="ts">
	import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Unlink from '@lucide/svelte/icons/unlink';
	import { Button } from '$lib/components/ui/button';
	import { isAllowedHref } from '$lib/content/links';
	import { m } from '$lib/paraglide/messages';
	import { BubbleMenu, getEditor, useEditorState } from '../tiptap';
	import { bubbleOptions } from './bubble-options';
	import LinkPopover from './link-popover.svelte';
	import ToolbarButton from './toolbar-button.svelte';

	const editor = getEditor();
	const href = useEditorState(editor, (current) => {
		const value: unknown = current.getAttributes('link').href;

		if (typeof value === 'string' && isAllowedHref(value)) {
			return value;
		}

		return '';
	});

	const shouldShow: BubbleMenuPluginProps['shouldShow'] = ({ editor: current, state }) =>
		current.isEditable && state.selection.empty && current.isActive('link');

	function openLink(): void {
		window.open(href.current, '_blank', 'noopener,noreferrer');
	}

	function removeLink(): void {
		editor.chain().focus().extendMarkRange('link').unsetLink().run();
	}
</script>

<BubbleMenu
	{editor}
	pluginKey="edra-link-bubble-menu"
	{shouldShow}
	options={bubbleOptions(editor)}
	class="flex max-w-sm items-center gap-1 rounded-xl border bg-popover p-1 shadow-md"
>
	{#if href.current !== ''}
		<Button
			variant="ghost"
			size="sm"
			class="max-w-56"
			title={m.editor_link_open()}
			onclick={openLink}
		>
			<ExternalLink />
			<span class="truncate">{href.current}</span>
		</Button>
	{/if}
	<LinkPopover />
	<ToolbarButton label={m.editor_link_remove()} onclick={removeLink}>
		<Unlink />
	</ToolbarButton>
</BubbleMenu>
