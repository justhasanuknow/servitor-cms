<script lang="ts">
	import Baseline from '@lucide/svelte/icons/baseline';
	import Check from '@lucide/svelte/icons/check';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import { highlightColor, quickColors } from '../colors';
	import type { ColorSelection } from '../colors.interfaces';
	import { getEditor, useEditorState } from '../tiptap';

	const editor = getEditor();
	const colors = quickColors();
	const selection = useEditorState(editor, (current): ColorSelection => ({
		text: stringOrNull(current.getAttributes('textStyle').color),
		highlight: stringOrNull(current.getAttributes('highlight').color)
	}));

	function stringOrNull(value: unknown): string | null {
		if (typeof value === 'string' && value !== '') {
			return value;
		}

		return null;
	}

	function keepSelection(event: MouseEvent): void {
		event.preventDefault();
	}

	function setTextColor(value: string | null): void {
		if (value === null) {
			editor.chain().focus().unsetColor().run();

			return;
		}

		editor.chain().focus().setColor(value).run();
	}

	function setHighlight(value: string | null): void {
		if (value === null) {
			editor.chain().focus().unsetHighlight().run();

			return;
		}

		editor
			.chain()
			.focus()
			.setHighlight({ color: highlightColor(value) })
			.run();
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
		aria-label={m.editor_colors()}
		title={m.editor_colors()}
		onmousedown={keepSelection}
	>
		<Baseline color={selection.current.text ?? 'currentColor'} />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="max-h-96 min-w-52 overflow-y-auto">
		<DropdownMenu.Group>
			<DropdownMenu.Label>{m.editor_text_color()}</DropdownMenu.Label>
			<DropdownMenu.Item onclick={() => setTextColor(null)}>
				<span class="w-4 text-center font-bold">A</span>
				<span class="flex-1">{m.editor_color_default()}</span>
				{#if selection.current.text === null}
					<Check class="text-muted-foreground" />
				{/if}
			</DropdownMenu.Item>
			{#each colors as color (color.id)}
				<DropdownMenu.Item onclick={() => setTextColor(color.value)}>
					<span class="w-4 text-center font-bold" style:color={color.value}>A</span>
					<span class="flex-1">{color.label}</span>
					{#if selection.current.text === color.value}
						<Check class="text-muted-foreground" />
					{/if}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Label>{m.editor_highlight()}</DropdownMenu.Label>
			<DropdownMenu.Item onclick={() => setHighlight(null)}>
				<span class="size-4 rounded-full border"></span>
				<span class="flex-1">{m.editor_color_default()}</span>
				{#if selection.current.highlight === null}
					<Check class="text-muted-foreground" />
				{/if}
			</DropdownMenu.Item>
			{#each colors as color (color.id)}
				<DropdownMenu.Item onclick={() => setHighlight(color.value)}>
					<span
						class="size-4 rounded-full border"
						style:background-color={highlightColor(color.value)}
					></span>
					<span class="flex-1">{color.label}</span>
					{#if selection.current.highlight === highlightColor(color.value)}
						<Check class="text-muted-foreground" />
					{/if}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
