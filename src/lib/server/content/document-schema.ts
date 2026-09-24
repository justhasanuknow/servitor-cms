import type { JSONContent } from '@tiptap/core';
import { z } from 'zod';
import {
	CONTENT_HEADING_LEVELS,
	MAX_CONTENT_CHILDREN,
	MAX_CONTENT_DEPTH,
	MAX_CONTENT_NODES,
	MAX_HREF_LENGTH,
	MAX_LATEX_LENGTH,
	MAX_LINK_ATTRIBUTE_LENGTH,
	MAX_MARKS_PER_NODE,
	MAX_ORDERED_LIST_START,
	MAX_TABLE_SPAN,
	MAX_TEXT_NODE_LENGTH,
	ORDERED_LIST_TYPES,
	VIDEO_PROVIDERS
} from '../../constants/content';
import { MAX_MEDIA_ALT_TEXT_LENGTH } from '../../constants/media';
import { isCodeLanguage } from '../../content/code-languages';
import { isAllowedColor, MAX_COLOR_LENGTH } from '../../content/colors';
import { isAllowedHref } from '../../content/links';
import { parseMediaUrl } from '../../content/media-urls';
import { isValidVideoId } from '../../content/video-embeds';
import type { DocumentValidationResult, PendingDocumentNode } from './document-schema.interfaces';

const MAX_IMAGE_DIMENSION = 100_000;

const MAX_VIDEO_ID_LENGTH = 32;

const childrenSchema = z.array(z.unknown()).max(MAX_CONTENT_CHILDREN);

const colorSchema = z.string().max(MAX_COLOR_LENGTH).refine(isAllowedColor);

const linkAttributeSchema = z.string().max(MAX_LINK_ATTRIBUTE_LENGTH).nullable().optional();

const markSchema = z.discriminatedUnion('type', [
	z.strictObject({ type: z.literal('bold') }),
	z.strictObject({ type: z.literal('italic') }),
	z.strictObject({ type: z.literal('underline') }),
	z.strictObject({ type: z.literal('strike') }),
	z.strictObject({
		type: z.literal('link'),
		attrs: z.strictObject({
			href: z.string().max(MAX_HREF_LENGTH).refine(isAllowedHref),
			target: linkAttributeSchema,
			rel: linkAttributeSchema,
			class: linkAttributeSchema,
			title: linkAttributeSchema
		})
	}),
	z.strictObject({
		type: z.literal('textStyle'),
		attrs: z.strictObject({ color: colorSchema.nullable().optional() }).optional()
	}),
	z.strictObject({
		type: z.literal('highlight'),
		attrs: z.strictObject({ color: colorSchema.nullable().optional() }).optional()
	})
]);

const marksSchema = z.array(markSchema).max(MAX_MARKS_PER_NODE).optional();

const latexSchema = z.string().max(MAX_LATEX_LENGTH);

const spanSchema = z.int().min(1).max(MAX_TABLE_SPAN);

const dimensionSchema = z.int().min(1).max(MAX_IMAGE_DIMENSION).nullable();

function containerSchema<Type extends string>(type: Type) {
	return z.strictObject({ type: z.literal(type), content: childrenSchema.optional() });
}

function cellSchema<Type extends string>(type: Type) {
	return z.strictObject({
		type: z.literal(type),
		attrs: z.strictObject({ colspan: spanSchema, rowspan: spanSchema }).optional(),
		content: childrenSchema.optional()
	});
}

const documentSchema = z.strictObject({ type: z.literal('doc'), content: childrenSchema });

const nodeSchema = z.discriminatedUnion('type', [
	containerSchema('paragraph'),
	z.strictObject({
		type: z.literal('heading'),
		attrs: z.strictObject({ level: z.literal(CONTENT_HEADING_LEVELS) }).optional(),
		content: childrenSchema.optional()
	}),
	containerSchema('blockquote'),
	containerSchema('bulletList'),
	z.strictObject({
		type: z.literal('orderedList'),
		attrs: z
			.strictObject({
				start: z.int().min(0).max(MAX_ORDERED_LIST_START),
				type: z.enum(ORDERED_LIST_TYPES).nullable()
			})
			.optional(),
		content: childrenSchema.optional()
	}),
	containerSchema('listItem'),
	containerSchema('taskList'),
	z.strictObject({
		type: z.literal('taskItem'),
		attrs: z.strictObject({ checked: z.boolean() }).optional(),
		content: childrenSchema.optional()
	}),
	z.strictObject({
		type: z.literal('codeBlock'),
		attrs: z
			.strictObject({ language: z.string().refine(isCodeLanguage).nullable() })
			.optional(),
		content: childrenSchema.optional()
	}),
	z.strictObject({
		type: z.literal('image'),
		attrs: z.strictObject({
			src: z.string().refine((value) => parseMediaUrl(value) !== null),
			alt: z.string().max(MAX_MEDIA_ALT_TEXT_LENGTH),
			width: dimensionSchema,
			height: dimensionSchema
		})
	}),
	z.strictObject({
		type: z.literal('videoEmbed'),
		attrs: z
			.strictObject({
				provider: z.enum(VIDEO_PROVIDERS),
				videoId: z.string().max(MAX_VIDEO_ID_LENGTH)
			})
			.refine((attrs) => isValidVideoId(attrs.provider, attrs.videoId))
	}),
	z.strictObject({ type: z.literal('blockMath'), attrs: z.strictObject({ latex: latexSchema }) }),
	z.strictObject({
		type: z.literal('inlineMath'),
		attrs: z.strictObject({ latex: latexSchema }),
		marks: marksSchema
	}),
	containerSchema('table'),
	containerSchema('tableRow'),
	cellSchema('tableHeader'),
	cellSchema('tableCell'),
	z.strictObject({ type: z.literal('hardBreak'), marks: marksSchema }),
	z.strictObject({
		type: z.literal('text'),
		text: z.string().min(1).max(MAX_TEXT_NODE_LENGTH),
		marks: marksSchema
	})
]);

type ParsedNode = z.infer<typeof nodeSchema>;

export function validateContentDocument(value: unknown): DocumentValidationResult {
	const root = documentSchema.safeParse(value);

	if (!root.success) {
		return { status: 'invalid' };
	}

	const topLevel: JSONContent[] = [];
	const queue: PendingDocumentNode[] = root.data.content.map((raw) => ({
		raw,
		depth: 1,
		siblings: topLevel
	}));
	let processed = 0;

	for (let head = 0; head < queue.length; head += 1) {
		const pending = queue[head];

		processed += 1;

		if (processed > MAX_CONTENT_NODES || pending.depth > MAX_CONTENT_DEPTH) {
			return { status: 'too_large' };
		}

		const parsed = nodeSchema.safeParse(pending.raw);

		if (!parsed.success) {
			return { status: 'invalid' };
		}

		const node = documentNode(parsed.data);

		pending.siblings.push(node);

		if ('content' in parsed.data && parsed.data.content !== undefined) {
			const children: JSONContent[] = [];

			node.content = children;

			for (const raw of parsed.data.content) {
				queue.push({ raw, depth: pending.depth + 1, siblings: children });
			}
		}
	}

	return { status: 'valid', document: { type: 'doc', content: topLevel } };
}

function documentNode(data: ParsedNode): JSONContent {
	const node: JSONContent = { type: data.type };

	if ('attrs' in data && data.attrs !== undefined) {
		node.attrs = data.attrs;
	}

	if ('marks' in data && data.marks !== undefined) {
		node.marks = data.marks;
	}

	if ('text' in data) {
		node.text = data.text;
	}

	return node;
}
