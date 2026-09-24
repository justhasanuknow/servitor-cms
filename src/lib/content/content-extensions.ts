import type { Extensions, Node, NodeViewRenderer } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';
import { Table, TableRow } from '@tiptap/extension-table';
import { TextStyle } from '@tiptap/extension-text-style';
import { StarterKit } from '@tiptap/starter-kit';
import { CONTENT_HEADING_LEVELS } from '../constants/content';
import type { ContentExtensionOptions } from './content-extensions.interfaces';
import { ContentCodeBlock } from './extensions/content-code-block';
import { ContentImage } from './extensions/content-image';
import { ContentOrderedList } from './extensions/content-lists';
import { ContentColor, ContentHighlight } from './extensions/content-marks';
import { ContentTableCell, ContentTableHeader } from './extensions/content-table';
import { VideoEmbed } from './extensions/video-embed';
import { isAllowedHref } from './links';
import { katexOptions } from './math';

export function contentExtensions(options: ContentExtensionOptions = {}): Extensions {
	return [
		StarterKit.configure({
			code: false,
			codeBlock: false,
			horizontalRule: false,
			orderedList: false,
			heading: { levels: [...CONTENT_HEADING_LEVELS] },
			link: {
				openOnClick: false,
				autolink: true,
				linkOnPaste: true,
				defaultProtocol: 'https',
				HTMLAttributes: { target: null, rel: null, class: null },
				isAllowedUri: (url: string) => isAllowedHref(url)
			}
		}),
		ContentOrderedList,
		TaskList,
		TaskItem.configure({ nested: true }),
		TextStyle,
		ContentColor,
		ContentHighlight,
		withNodeView(ContentCodeBlock, options.nodeViews?.codeBlock),
		withNodeView(ContentImage, options.nodeViews?.image),
		withNodeView(VideoEmbed, options.nodeViews?.videoEmbed),
		InlineMath.configure({
			katexOptions: katexOptions(false),
			onClick: options.onInlineMathClick
		}),
		BlockMath.configure({
			katexOptions: katexOptions(true),
			onClick: options.onBlockMathClick
		}),
		Table.configure({ resizable: false }),
		TableRow,
		ContentTableHeader,
		ContentTableCell
	];
}

function withNodeView<Options, Storage>(
	node: Node<Options, Storage>,
	view: NodeViewRenderer | undefined
): Node<Options, Storage> {
	if (view === undefined) {
		return node;
	}

	return node.extend({
		addNodeView() {
			return view;
		}
	});
}
