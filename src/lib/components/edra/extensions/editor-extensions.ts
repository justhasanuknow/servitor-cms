import type { Extensions } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Placeholder } from '@tiptap/extensions';
import { contentExtensions } from '$lib/content/content-extensions';
import { m } from '$lib/paraglide/messages';
import { slashCommandGroups } from '../commands';
import type { EdraActions } from '../commands.interfaces';
import CodeBlockView from '../shadcn/code-block-view.svelte';
import ImageView from '../shadcn/image-view.svelte';
import SlashCommandList from '../shadcn/slash-command-list.svelte';
import VideoEmbedView from '../shadcn/video-embed-view.svelte';
import { SvelteNodeViewRenderer } from '../tiptap/svelte-node-view-renderer';
import { SlashCommand } from './slash-command';

export function editorExtensions(actions: EdraActions): Extensions {
	return [
		...contentExtensions({
			nodeViews: {
				codeBlock: SvelteNodeViewRenderer(CodeBlockView),
				image: SvelteNodeViewRenderer(ImageView),
				videoEmbed: SvelteNodeViewRenderer(VideoEmbedView)
			}
		}),
		Placeholder.configure({
			emptyEditorClass: 'is-editor-empty',
			emptyNodeClass: 'is-empty',
			placeholder: ({ node }) => placeholderFor(node)
		}),
		SlashCommand({
			groups: () => slashCommandGroups(actions),
			list: SlashCommandList
		})
	];
}

function placeholderFor(node: ProseMirrorNode): string {
	if (node.type.name === 'heading') {
		return m.editor_placeholder_heading();
	}

	if (node.type.name === 'paragraph') {
		return m.editor_placeholder_paragraph();
	}

	return '';
}
