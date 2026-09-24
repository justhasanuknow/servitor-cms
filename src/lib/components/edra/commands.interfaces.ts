import type { LucideIcon } from '@lucide/svelte';
import type { Editor } from '@tiptap/core';

export interface EdraCommand {
	id: string;
	label: string;
	icon: LucideIcon;
	shortcut?: string;
	run: (editor: Editor) => void;
	isActive?: (editor: Editor) => boolean;
	canRun?: (editor: Editor) => boolean;
}

export interface EdraCommandGroup {
	id: string;
	label: string;
	commands: EdraCommand[];
}

export interface CommandStatus {
	version: number;
	active: ReadonlySet<string>;
	disabled: ReadonlySet<string>;
}

export interface EdraActions {
	requestImage: () => void;
	requestVideo: () => void;
}
