<script lang="ts">
	import type { JSONContent } from '@tiptap/core';
	import { NodeSelection } from '@tiptap/pm/state';
	import 'katex/dist/katex.min.css';
	import { untrack } from 'svelte';
	import MediaPickerDialog from '$lib/components/media/media-picker-dialog.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { MEDIA_CONTENT_VARIANT } from '$lib/constants/media';
	import { mediaUrl } from '$lib/content/media-urls';
	import type { VideoEmbedReference } from '$lib/modules/interfaces/content.interfaces';
	import type { MediaPickerItem } from '$lib/modules/interfaces/media.interfaces';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { EdraActions } from '../commands.interfaces';
	import { editorExtensions } from '../extensions/editor-extensions';
	import { EditorContent, setEditor, useEditor } from '../tiptap';
	import './editor.css';
	import type { EdraEditorProps } from './edra-editor.interfaces';
	import LinkBubbleMenu from './link-bubble-menu.svelte';
	import MathMenu from './math-menu.svelte';
	import TableMenu from './table-menu.svelte';
	import TextBubbleMenu from './text-bubble-menu.svelte';
	import Toolbar from './toolbar.svelte';
	import VideoEmbedDialog from './video-embed-dialog.svelte';

	let { content, languageCode, onChange, onBlur, class: className }: EdraEditorProps = $props();

	let imagePickerOpen = $state(false);
	let videoDialogOpen = $state(false);

	const actions: EdraActions = {
		requestImage: () => {
			imagePickerOpen = true;
		},
		requestVideo: () => {
			videoDialogOpen = true;
		}
	};

	const editor = useEditor({
		extensions: editorExtensions(actions),
		content: parseDocument(untrack(() => content)),
		editorProps: {
			attributes: {
				class: 'servitor-content edra-content',
				role: 'textbox',
				'aria-multiline': 'true',
				'aria-label': m.editor_content_label()
			}
		},
		onUpdate: ({ editor: current }) => {
			onChange(JSON.stringify(current.getJSON()));
		},
		onBlur: () => {
			onBlur?.();
		}
	});

	if (editor !== undefined) {
		setEditor(editor);
	}

	function parseDocument(value: string): JSONContent | null {
		try {
			const parsed: unknown = JSON.parse(value);

			if (isDocument(parsed)) {
				return parsed;
			}

			return null;
		} catch {
			return null;
		}
	}

	function isDocument(value: unknown): value is JSONContent {
		return (
			typeof value === 'object' && value !== null && 'type' in value && value.type === 'doc'
		);
	}

	function insertBlock(node: JSONContent): void {
		if (editor === undefined) {
			return;
		}

		const { selection } = editor.state;

		if (selection instanceof NodeSelection) {
			editor.chain().focus().insertContentAt(selection.to, node).run();

			return;
		}

		editor.chain().focus().insertContent(node).run();
	}

	function insertImage(item: MediaPickerItem): void {
		insertBlock({
			type: 'image',
			attrs: {
				src: mediaUrl(item.id, MEDIA_CONTENT_VARIANT),
				alt: item.alt,
				width: item.width,
				height: item.height
			}
		});
	}

	function insertVideo(reference: VideoEmbedReference): void {
		insertBlock({ type: 'videoEmbed', attrs: { ...reference } });
	}
</script>

<Tooltip.Provider delayDuration={300}>
	<div class={cn('edra overflow-hidden rounded-xl border bg-background', className)}>
		{#if editor !== undefined}
			<Toolbar {actions} />
			<EditorContent {editor} class="edra-scroll px-4 py-6 sm:px-8" />
			<TextBubbleMenu />
			<LinkBubbleMenu />
			<MathMenu kind="inlineMath" />
			<MathMenu kind="blockMath" />
			<TableMenu />
		{:else}
			<div class="min-h-80 animate-pulse bg-muted/40" aria-hidden="true"></div>
		{/if}
	</div>
</Tooltip.Provider>
<MediaPickerDialog bind:open={imagePickerOpen} {languageCode} onSelect={insertImage} />
<VideoEmbedDialog bind:open={videoDialogOpen} onInsert={insertVideo} />
