import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import type { EdraCommand, EdraCommandGroup } from '../commands.interfaces';
import { SvelteRenderer } from '../tiptap/svelte-renderer.svelte';
import type {
	SlashCommandListExports,
	SlashCommandListProps,
	SlashCommandOptions
} from './slash-command.interfaces';

const EXTENSION_NAME = 'slashCommand';

const POPUP_CLASS = 'edra-slash-popup';

const POPUP_OFFSET = 8;

type ClientRect = () => DOMRect | null;

export function SlashCommand(options: SlashCommandOptions): Extension {
	return Extension.create({
		name: EXTENSION_NAME,
		priority: 200,
		addProseMirrorPlugins() {
			return [
				Suggestion<EdraCommandGroup, EdraCommand>({
					editor: this.editor,
					char: '/',
					pluginKey: new PluginKey(EXTENSION_NAME),
					command: ({ editor, range, props }) => {
						editor.chain().focus().deleteRange(range).run();
						props.run(editor);
					},
					items: ({ query }) => filterGroups(options.groups(), query),
					render: () => createPopup(options)
				})
			];
		}
	});
}

function filterGroups(groups: EdraCommandGroup[], query: string): EdraCommandGroup[] {
	const needle = query.trim().toLocaleLowerCase();

	return groups
		.map((group) => ({
			...group,
			commands: group.commands.filter((command) =>
				command.label.toLocaleLowerCase().includes(needle)
			)
		}))
		.filter((group) => group.commands.length > 0);
}

function createPopup(options: SlashCommandOptions) {
	let renderer: SvelteRenderer<SlashCommandListProps, SlashCommandListExports> | null = null;
	let popup: HTMLDivElement | null = null;
	let clientRect: ClientRect | null = null;
	let stopAutoUpdate: (() => void) | null = null;

	function reposition(): void {
		const rect = clientRect?.();

		if (popup === null || rect === null || rect === undefined) {
			return;
		}

		const element = popup;

		void computePosition({ getBoundingClientRect: () => rect }, element, {
			placement: 'bottom-start',
			strategy: 'fixed',
			middleware: [offset(POPUP_OFFSET), flip(), shift({ padding: POPUP_OFFSET })]
		}).then(({ x, y }) => {
			element.style.left = `${x}px`;
			element.style.top = `${y}px`;
		});
	}

	function hide(): void {
		if (popup !== null) {
			popup.style.visibility = 'hidden';
		}
	}

	function update(props: SuggestionProps<EdraCommandGroup, EdraCommand>): void {
		clientRect = props.clientRect ?? null;
		renderer?.updateProps({ items: props.items, command: props.command });

		if (popup !== null) {
			popup.style.visibility = 'visible';
		}

		reposition();
	}

	return {
		onStart(props: SuggestionProps<EdraCommandGroup, EdraCommand>): void {
			popup = document.createElement('div');
			popup.className = POPUP_CLASS;
			popup.style.position = 'fixed';
			popup.style.zIndex = '50';
			document.body.appendChild(popup);
			renderer = new SvelteRenderer(options.list, {
				items: props.items,
				command: props.command
			});

			if (renderer.element !== null) {
				popup.appendChild(renderer.element);
			}

			update(props);

			const element = popup;

			stopAutoUpdate = autoUpdate(
				{ getBoundingClientRect: () => clientRect?.() ?? new DOMRect() },
				element,
				reposition
			);
		},
		onUpdate(props: SuggestionProps<EdraCommandGroup, EdraCommand>): void {
			update(props);
		},
		onKeyDown(props: SuggestionKeyDownProps): boolean {
			if (props.event.key === 'Escape') {
				hide();

				return true;
			}

			return renderer?.ref?.handleKeyDown(props.event) ?? false;
		},
		onExit(): void {
			stopAutoUpdate?.();
			stopAutoUpdate = null;
			renderer?.destroy();
			renderer = null;
			popup?.remove();
			popup = null;
			clientRect = null;
		}
	};
}
