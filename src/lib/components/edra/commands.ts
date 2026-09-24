import Bold from '@lucide/svelte/icons/bold';
import FileCode from '@lucide/svelte/icons/file-code';
import Heading2 from '@lucide/svelte/icons/heading-2';
import Heading3 from '@lucide/svelte/icons/heading-3';
import Heading4 from '@lucide/svelte/icons/heading-4';
import Image from '@lucide/svelte/icons/image';
import Italic from '@lucide/svelte/icons/italic';
import List from '@lucide/svelte/icons/list';
import ListChecks from '@lucide/svelte/icons/list-checks';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import Pilcrow from '@lucide/svelte/icons/pilcrow';
import Quote from '@lucide/svelte/icons/quote';
import Radical from '@lucide/svelte/icons/radical';
import Redo from '@lucide/svelte/icons/redo-2';
import SquareRadical from '@lucide/svelte/icons/square-radical';
import Strikethrough from '@lucide/svelte/icons/strikethrough';
import Table from '@lucide/svelte/icons/table';
import Underline from '@lucide/svelte/icons/underline';
import Undo from '@lucide/svelte/icons/undo-2';
import Video from '@lucide/svelte/icons/video';
import type { Editor } from '@tiptap/core';
import { m } from '$lib/paraglide/messages';
import type {
	CommandStatus,
	EdraActions,
	EdraCommand,
	EdraCommandGroup
} from './commands.interfaces';

const DEFAULT_TABLE_SIZE = 3;

const NEW_MATH_EXPRESSION = 'x';

export function historyCommands(): EdraCommand[] {
	return [
		{
			id: 'undo',
			label: m.editor_undo(),
			icon: Undo,
			shortcut: 'Mod+Z',
			run: (editor) => editor.chain().focus().undo().run(),
			canRun: (editor) => editor.can().undo()
		},
		{
			id: 'redo',
			label: m.editor_redo(),
			icon: Redo,
			shortcut: 'Mod+Shift+Z',
			run: (editor) => editor.chain().focus().redo().run(),
			canRun: (editor) => editor.can().redo()
		}
	];
}

export function blockTypeCommands(): EdraCommand[] {
	return [
		{
			id: 'paragraph',
			label: m.editor_paragraph(),
			icon: Pilcrow,
			shortcut: 'Mod+Alt+0',
			run: (editor) => editor.chain().focus().setParagraph().run(),
			isActive: (editor) => editor.isActive('paragraph')
		},
		heading(2, Heading2, m.editor_heading_2()),
		heading(3, Heading3, m.editor_heading_3()),
		heading(4, Heading4, m.editor_heading_4())
	];
}

export function markCommands(): EdraCommand[] {
	return [
		{
			id: 'bold',
			label: m.editor_bold(),
			icon: Bold,
			shortcut: 'Mod+B',
			run: (editor) => editor.chain().focus().toggleBold().run(),
			isActive: (editor) => editor.isActive('bold'),
			canRun: (editor) => editor.can().toggleBold()
		},
		{
			id: 'italic',
			label: m.editor_italic(),
			icon: Italic,
			shortcut: 'Mod+I',
			run: (editor) => editor.chain().focus().toggleItalic().run(),
			isActive: (editor) => editor.isActive('italic'),
			canRun: (editor) => editor.can().toggleItalic()
		},
		{
			id: 'underline',
			label: m.editor_underline(),
			icon: Underline,
			shortcut: 'Mod+U',
			run: (editor) => editor.chain().focus().toggleUnderline().run(),
			isActive: (editor) => editor.isActive('underline'),
			canRun: (editor) => editor.can().toggleUnderline()
		},
		{
			id: 'strike',
			label: m.editor_strike(),
			icon: Strikethrough,
			shortcut: 'Mod+Shift+S',
			run: (editor) => editor.chain().focus().toggleStrike().run(),
			isActive: (editor) => editor.isActive('strike'),
			canRun: (editor) => editor.can().toggleStrike()
		}
	];
}

export function blockCommands(): EdraCommand[] {
	return [
		{
			id: 'blockquote',
			label: m.editor_blockquote(),
			icon: Quote,
			shortcut: 'Mod+Shift+B',
			run: (editor) => editor.chain().focus().toggleBlockquote().run(),
			isActive: (editor) => editor.isActive('blockquote')
		},
		{
			id: 'codeBlock',
			label: m.editor_code_block(),
			icon: FileCode,
			shortcut: 'Mod+Alt+C',
			run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
			isActive: (editor) => editor.isActive('codeBlock')
		}
	];
}

export function listCommands(): EdraCommand[] {
	return [
		{
			id: 'bulletList',
			label: m.editor_bullet_list(),
			icon: List,
			shortcut: 'Mod+Shift+8',
			run: (editor) => editor.chain().focus().toggleBulletList().run(),
			isActive: (editor) => editor.isActive('bulletList')
		},
		{
			id: 'orderedList',
			label: m.editor_ordered_list(),
			icon: ListOrdered,
			shortcut: 'Mod+Shift+7',
			run: (editor) => editor.chain().focus().toggleOrderedList().run(),
			isActive: (editor) => editor.isActive('orderedList')
		},
		{
			id: 'taskList',
			label: m.editor_task_list(),
			icon: ListChecks,
			shortcut: 'Mod+Shift+9',
			run: (editor) => editor.chain().focus().toggleTaskList().run(),
			isActive: (editor) => editor.isActive('taskList')
		}
	];
}

export function insertCommands(actions: EdraActions): EdraCommand[] {
	return [
		{
			id: 'image',
			label: m.editor_image(),
			icon: Image,
			run: () => actions.requestImage(),
			isActive: (editor) => editor.isActive('image')
		},
		{
			id: 'video',
			label: m.editor_video(),
			icon: Video,
			run: () => actions.requestVideo(),
			isActive: (editor) => editor.isActive('videoEmbed')
		},
		{
			id: 'table',
			label: m.editor_table(),
			icon: Table,
			run: (editor) =>
				editor
					.chain()
					.focus()
					.insertTable({
						rows: DEFAULT_TABLE_SIZE,
						cols: DEFAULT_TABLE_SIZE,
						withHeaderRow: true
					})
					.run(),
			isActive: (editor) => editor.isActive('table'),
			canRun: (editor) => !editor.isActive('table')
		},
		{
			id: 'inlineMath',
			label: m.editor_inline_math(),
			icon: Radical,
			run: (editor) => insertInlineMath(editor),
			isActive: (editor) => editor.isActive('inlineMath')
		},
		{
			id: 'blockMath',
			label: m.editor_block_math(),
			icon: SquareRadical,
			run: (editor) =>
				editor.chain().focus().insertBlockMath({ latex: NEW_MATH_EXPRESSION }).run(),
			isActive: (editor) => editor.isActive('blockMath')
		}
	];
}

export function slashCommandGroups(actions: EdraActions): EdraCommandGroup[] {
	return [
		{
			id: 'format',
			label: m.editor_group_format(),
			commands: [
				...blockTypeCommands().filter((command) => command.id !== 'paragraph'),
				...blockCommands(),
				...listCommands()
			]
		},
		{
			id: 'insert',
			label: m.editor_group_insert(),
			commands: insertCommands(actions)
		}
	];
}

export function commandStatus(
	editor: Editor,
	commands: EdraCommand[],
	version: number
): CommandStatus {
	const active = new Set<string>();
	const disabled = new Set<string>();

	for (const command of commands) {
		if (command.isActive?.(editor)) {
			active.add(command.id);
		}

		if (command.canRun && !command.canRun(editor)) {
			disabled.add(command.id);
		}
	}

	return { version, active, disabled };
}

export function shortcutLabel(shortcut: string, mac: boolean): string {
	const parts = shortcut.split('+').map((part) => keyLabel(part, mac));

	if (mac) {
		return parts.join('');
	}

	return parts.join('+');
}

function keyLabel(key: string, mac: boolean): string {
	if (key === 'Mod') {
		return platformKey(mac, '⌘', 'Ctrl');
	}

	if (key === 'Alt') {
		return platformKey(mac, '⌥', 'Alt');
	}

	if (key === 'Shift') {
		return platformKey(mac, '⇧', 'Shift');
	}

	return key;
}

function platformKey(mac: boolean, macLabel: string, otherLabel: string): string {
	if (mac) {
		return macLabel;
	}

	return otherLabel;
}

function heading(level: 2 | 3 | 4, icon: EdraCommand['icon'], label: string): EdraCommand {
	return {
		id: `heading${level}`,
		label,
		icon,
		shortcut: `Mod+Alt+${level}`,
		run: (editor) => editor.chain().focus().toggleHeading({ level }).run(),
		isActive: (editor) => editor.isActive('heading', { level })
	};
}

function insertInlineMath(editor: Editor): void {
	const { from, to, empty } = editor.state.selection;
	let latex = NEW_MATH_EXPRESSION;

	if (!empty) {
		latex = editor.state.doc.textBetween(from, to).trim() || NEW_MATH_EXPRESSION;
	}

	editor.chain().focus().deleteRange({ from, to }).insertInlineMath({ latex, pos: from }).run();
}
