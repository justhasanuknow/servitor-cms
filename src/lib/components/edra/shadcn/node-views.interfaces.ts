import type { EdraNodeViewProps } from '../tiptap/node-view.interfaces';

export type CodeBlockViewProps = Pick<EdraNodeViewProps, 'editor' | 'node' | 'updateAttributes'>;

export type ImageViewProps = Pick<
	EdraNodeViewProps,
	'editor' | 'node' | 'selected' | 'updateAttributes'
>;

export type VideoEmbedViewProps = Pick<EdraNodeViewProps, 'node' | 'selected'>;
