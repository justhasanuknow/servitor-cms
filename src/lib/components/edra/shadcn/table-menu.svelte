<script lang="ts">
	import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import ArrowLeftToLine from '@lucide/svelte/icons/arrow-left-to-line';
	import ArrowRightToLine from '@lucide/svelte/icons/arrow-right-to-line';
	import ArrowUpToLine from '@lucide/svelte/icons/arrow-up-to-line';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import Rows3 from '@lucide/svelte/icons/rows-3';
	import Sheet from '@lucide/svelte/icons/sheet';
	import TableCellsMerge from '@lucide/svelte/icons/table-cells-merge';
	import TableCellsSplit from '@lucide/svelte/icons/table-cells-split';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Separator } from '$lib/components/ui/separator';
	import { m } from '$lib/paraglide/messages';
	import { BubbleMenu, getEditor, useEditorState } from '../tiptap';
	import { bubbleOptions } from './bubble-options';
	import ToolbarButton from './toolbar-button.svelte';

	const editor = getEditor();
	const cells = useEditorState(editor, (current) => ({
		merge: current.can().mergeCells(),
		split: current.can().splitCell()
	}));

	const shouldShow: BubbleMenuPluginProps['shouldShow'] = ({ editor: current }) =>
		current.isEditable && current.isActive('table');
</script>

<BubbleMenu
	{editor}
	pluginKey="edra-table-menu"
	{shouldShow}
	options={{ ...bubbleOptions(editor), placement: 'bottom' }}
	class="flex flex-wrap items-center gap-0.5 rounded-xl border bg-popover p-1 shadow-md"
>
	<ToolbarButton
		label={m.editor_table_add_row_before()}
		onclick={() => editor.chain().focus().addRowBefore().run()}
	>
		<ArrowUpToLine />
	</ToolbarButton>
	<ToolbarButton
		label={m.editor_table_add_row_after()}
		onclick={() => editor.chain().focus().addRowAfter().run()}
	>
		<ArrowDownToLine />
	</ToolbarButton>
	<ToolbarButton
		label={m.editor_table_delete_row()}
		onclick={() => editor.chain().focus().deleteRow().run()}
	>
		<Rows3 />
	</ToolbarButton>
	<Separator orientation="vertical" class="mx-1 h-5!" />
	<ToolbarButton
		label={m.editor_table_add_column_before()}
		onclick={() => editor.chain().focus().addColumnBefore().run()}
	>
		<ArrowLeftToLine />
	</ToolbarButton>
	<ToolbarButton
		label={m.editor_table_add_column_after()}
		onclick={() => editor.chain().focus().addColumnAfter().run()}
	>
		<ArrowRightToLine />
	</ToolbarButton>
	<ToolbarButton
		label={m.editor_table_delete_column()}
		onclick={() => editor.chain().focus().deleteColumn().run()}
	>
		<Columns3 />
	</ToolbarButton>
	<Separator orientation="vertical" class="mx-1 h-5!" />
	<ToolbarButton
		label={m.editor_table_toggle_header_row()}
		onclick={() => editor.chain().focus().toggleHeaderRow().run()}
	>
		<Sheet />
	</ToolbarButton>
	<ToolbarButton
		label={m.editor_table_merge_cells()}
		disabled={!cells.current.merge}
		onclick={() => editor.chain().focus().mergeCells().run()}
	>
		<TableCellsMerge />
	</ToolbarButton>
	<ToolbarButton
		label={m.editor_table_split_cell()}
		disabled={!cells.current.split}
		onclick={() => editor.chain().focus().splitCell().run()}
	>
		<TableCellsSplit />
	</ToolbarButton>
	<Separator orientation="vertical" class="mx-1 h-5!" />
	<ToolbarButton
		label={m.editor_table_delete()}
		onclick={() => editor.chain().focus().deleteTable().run()}
	>
		<Trash2 />
	</ToolbarButton>
</BubbleMenu>
