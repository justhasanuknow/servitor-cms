import { NodeView, type NodeViewRenderer } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Component } from 'svelte';
import type { Editor } from './editor';
import NodeViewFrame from './node-view-frame.svelte';
import type { EdraNodeViewProps, NodeViewFrameProps } from './node-view.interfaces';
import { SvelteRenderer } from './svelte-renderer.svelte';

const SELECTED_CLASS = 'ProseMirror-selectednode';

class SvelteNodeView extends NodeView<Component<EdraNodeViewProps>, Editor> {
	declare renderer: SvelteRenderer<NodeViewFrameProps>;

	mount(): void {
		this.handleSelectionUpdate = this.handleSelectionUpdate.bind(this);
		this.editor.on('selectionUpdate', this.handleSelectionUpdate);
		this.renderer = new SvelteRenderer(NodeViewFrame, {
			component: this.component,
			onDragStart: (event: DragEvent) => this.onDragStart(event),
			editor: this.editor,
			node: this.node,
			selected: false,
			getPos: () => this.getPos(),
			updateAttributes: (attributes: Record<string, unknown>) =>
				this.updateAttributes(attributes),
			deleteNode: () => this.deleteNode()
		});
	}

	get dom(): HTMLElement {
		const element = this.renderer.element;

		if (!(element instanceof HTMLElement) || !element.hasAttribute('data-node-view-wrapper')) {
			throw new Error('Node views must render a NodeViewWrapper');
		}

		return element;
	}

	get contentDOM(): HTMLElement | null {
		if (this.node.isLeaf) {
			return null;
		}

		return this.dom.querySelector<HTMLElement>('[data-node-view-content]');
	}

	handleSelectionUpdate(): void {
		const { from, to } = this.editor.state.selection;
		const position = this.getPos();

		if (typeof position !== 'number') {
			return;
		}

		const covered = from <= position && to >= position + this.node.nodeSize;

		if (covered && !this.renderer.props.selected) {
			this.selectNode();
		}

		if (!covered && this.renderer.props.selected) {
			this.deselectNode();
		}
	}

	update(node: ProseMirrorNode): boolean {
		if (node.type !== this.node.type) {
			return false;
		}

		if (node !== this.node) {
			this.node = node;
			this.renderer.updateProps({ node });
		}

		return true;
	}

	selectNode(): void {
		this.renderer.updateProps({ selected: true });
		this.renderer.element?.classList.add(SELECTED_CLASS);
	}

	deselectNode(): void {
		this.renderer.updateProps({ selected: false });
		this.renderer.element?.classList.remove(SELECTED_CLASS);
	}

	destroy(): void {
		this.renderer.destroy();
		this.editor.off('selectionUpdate', this.handleSelectionUpdate);
	}
}

export function SvelteNodeViewRenderer(component: Component<EdraNodeViewProps>): NodeViewRenderer {
	return (props) => new SvelteNodeView(component, props);
}
