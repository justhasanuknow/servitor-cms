import { getContext, setContext } from 'svelte';

const DRAG_START_CONTEXT = Symbol('edra-node-view-drag-start');

type DragStartHandler = (event: DragEvent) => void;

export function setNodeViewDragStart(handler: () => DragStartHandler): void {
	setContext(DRAG_START_CONTEXT, handler);
}

export function getNodeViewDragStart(): (() => DragStartHandler) | undefined {
	return getContext<(() => DragStartHandler) | undefined>(DRAG_START_CONTEXT);
}
