import type { Component } from 'svelte';
import type { EdraCommand, EdraCommandGroup } from '../commands.interfaces';

export interface SlashCommandListProps extends Record<string, unknown> {
	items: EdraCommandGroup[];
	command: (item: EdraCommand) => void;
}

export type SlashCommandListViewProps = Pick<SlashCommandListProps, 'items' | 'command'>;

export interface SlashCommandListExports extends Record<string, unknown> {
	handleKeyDown: (event: KeyboardEvent) => boolean;
}

export interface SlashCommandOptions {
	groups: () => EdraCommandGroup[];
	list: Component<SlashCommandListProps, SlashCommandListExports>;
}
