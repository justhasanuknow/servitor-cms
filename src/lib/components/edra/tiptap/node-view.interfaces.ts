import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Component, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { Editor } from './editor';

export interface EdraNodeViewProps extends Record<string, unknown> {
	editor: Editor;
	node: ProseMirrorNode;
	selected: boolean;
	getPos: () => number | undefined;
	updateAttributes: (attributes: Record<string, unknown>) => void;
	deleteNode: () => void;
}

export interface NodeViewFrameProps extends EdraNodeViewProps {
	component: Component<EdraNodeViewProps>;
	onDragStart: (event: DragEvent) => void;
}

export interface NodeViewWrapperProps extends HTMLAttributes<HTMLElement> {
	as?: string;
	children?: Snippet;
}

export interface NodeViewContentProps {
	as?: string;
	class?: string;
}

export interface EditorContentProps {
	editor: Editor;
	class?: string;
}
