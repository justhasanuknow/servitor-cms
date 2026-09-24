import type { NodeViewRenderer } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface ContentNodeViews {
	codeBlock?: NodeViewRenderer;
	image?: NodeViewRenderer;
	videoEmbed?: NodeViewRenderer;
}

export interface ContentExtensionOptions {
	nodeViews?: ContentNodeViews;
	onInlineMathClick?: (node: ProseMirrorNode, position: number) => void;
	onBlockMathClick?: (node: ProseMirrorNode, position: number) => void;
}
