<script lang="ts">
	import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { MAX_LATEX_LENGTH } from '$lib/constants/content';
	import { m } from '$lib/paraglide/messages';
	import { BubbleMenu, getEditor, useEditorState } from '../tiptap';
	import { bubbleOptions } from './bubble-options';
	import type { MathMenuProps } from './math-menu.interfaces';

	let { kind }: MathMenuProps = $props();

	const editor = getEditor();
	const stored = useEditorState(editor, (current) => {
		const value: unknown = current.getAttributes(kind).latex;

		if (typeof value === 'string') {
			return value;
		}

		return '';
	});

	let draft = $derived(stored.current);

	const shouldShow: BubbleMenuPluginProps['shouldShow'] = ({ editor: current }) =>
		current.isEditable && current.isActive(kind);

	function apply(event: SubmitEvent): void {
		event.preventDefault();

		const latex = draft.trim();

		if (latex === '') {
			return;
		}

		if (kind === 'inlineMath') {
			editor.chain().focus().updateInlineMath({ latex }).run();

			return;
		}

		editor.chain().focus().updateBlockMath({ latex }).run();
	}
</script>

<BubbleMenu
	{editor}
	pluginKey={`edra-${kind}-menu`}
	{shouldShow}
	options={bubbleOptions(editor)}
	class="rounded-xl border bg-popover p-2 shadow-md"
>
	<form class="flex w-80 flex-col gap-2" onsubmit={apply}>
		<Textarea
			value={draft}
			oninput={(event) => (draft = event.currentTarget.value)}
			maxlength={MAX_LATEX_LENGTH}
			rows={3}
			class="font-mono text-sm"
			aria-label={m.editor_math_label()}
			placeholder={m.editor_math_placeholder()}
		/>
		<div class="flex justify-end">
			<Button type="submit" size="sm">{m.editor_math_apply()}</Button>
		</div>
	</form>
</BubbleMenu>
