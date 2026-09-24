import { getSchema, type JSONContent } from '@tiptap/core';
import { contentExtensions } from '../../content/content-extensions';

export const CONTENT_EXTENSIONS = contentExtensions();

export const CONTENT_SCHEMA = getSchema(CONTENT_EXTENSIONS);

export function emptyContentDocument(): JSONContent {
	return { type: 'doc', content: [{ type: 'paragraph' }] };
}
