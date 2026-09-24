import { generateHTML } from '@tiptap/html/server';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { MAX_CONTENT_JSON_LENGTH } from '../../constants/content';
import { CONTENT_EXTENSIONS, CONTENT_SCHEMA } from './content-schema';
import { documentText, readingTimeMinutes, referencedMediaIds } from './content-text';
import { validateContentDocument } from './document-schema';
import type { ContentRenderResult } from './render-content.interfaces';
import { renderMathPlaceholders } from './render-math';
import { sanitizeContentHtml } from './sanitize-content';

export function renderContent(json: string): ContentRenderResult {
	if (json.length > MAX_CONTENT_JSON_LENGTH) {
		return { status: 'too_large' };
	}

	let value: unknown;

	try {
		value = JSON.parse(json);
	} catch {
		return { status: 'invalid' };
	}

	return renderContentDocument(value);
}

export function renderContentDocument(value: unknown): ContentRenderResult {
	const validation = validateContentDocument(value);

	if (validation.status !== 'valid') {
		return validation;
	}

	let document: ProseMirrorNode;

	try {
		document = ProseMirrorNode.fromJSON(CONTENT_SCHEMA, validation.document);
		document.check();
	} catch {
		return { status: 'invalid' };
	}

	const sanitized = sanitizeContentHtml(generateHTML(validation.document, CONTENT_EXTENSIONS));
	const text = documentText(document);

	return {
		status: 'rendered',
		content: {
			json: JSON.stringify(validation.document),
			html: renderMathPlaceholders(sanitized.html, sanitized.math),
			text,
			readingTimeMinutes: readingTimeMinutes(text),
			mediaIds: referencedMediaIds(document)
		}
	};
}
