import sanitizeHtml from 'sanitize-html';
import { MAX_TABLE_SPAN } from '../../constants/content';
import { isCodeLanguage } from '../../content/code-languages';
import { COLOR_PATTERNS } from '../../content/colors';
import { imageDimension } from '../../content/extensions/content-image';
import { isOrderedListType } from '../../content/extensions/content-lists';
import { isAllowedHref, isExternalHref } from '../../content/links';
import { parseMediaUrl } from '../../content/media-urls';
import {
	parseVideoEmbedUrl,
	VIDEO_EMBED_ALLOW,
	VIDEO_EMBED_HOSTNAMES,
	VIDEO_EMBED_REFERRER_POLICY,
	VIDEO_EMBED_SANDBOX,
	VIDEO_PROVIDER_NAMES,
	videoEmbedUrl
} from '../../content/video-embeds';
import type { MathSource, SanitizedContent } from './sanitize-content.interfaces';

type Attributes = sanitizeHtml.Attributes;

type Tag = sanitizeHtml.Tag;

const EXTERNAL_LINK_REL = 'noopener noreferrer nofollow';

const HIGHLIGHT_CLASS = /^(?:hljs-[a-z0-9_-]+|[a-z]+_+)$/;

const LANGUAGE_CLASS_PREFIX = 'language-';

const SPAN_PATTERN = /^[1-9][0-9]{0,2}$/;

const START_PATTERN = /^[0-9]{1,7}$/;

const NESTING_LIMIT = 200;

const ALLOWED_TAGS = [
	'p',
	'br',
	'h2',
	'h3',
	'h4',
	'strong',
	'em',
	'u',
	's',
	'blockquote',
	'ul',
	'ol',
	'li',
	'label',
	'input',
	'div',
	'span',
	'pre',
	'code',
	'a',
	'img',
	'mark',
	'table',
	'tbody',
	'tr',
	'th',
	'td',
	'iframe'
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
	a: ['href', 'title', 'target', 'rel'],
	img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
	iframe: ['src', 'title', 'loading', 'referrerpolicy', 'sandbox', 'allow'],
	ol: ['start', 'type'],
	ul: ['data-type'],
	li: ['data-type', 'data-checked'],
	input: ['type', 'checked', 'disabled'],
	td: ['colspan', 'rowspan'],
	th: ['colspan', 'rowspan'],
	code: ['class'],
	span: ['class', 'style', 'data-type', 'data-math-index'],
	mark: ['style'],
	div: ['data-type', 'data-math-index']
};

export function sanitizeContentHtml(html: string): SanitizedContent {
	const math: MathSource[] = [];
	const sanitized = sanitizeHtml(html, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: ALLOWED_ATTRIBUTES,
		allowedClasses: {
			code: [/^language-[a-z0-9][a-z0-9_+#.-]*$/i],
			span: [HIGHLIGHT_CLASS]
		},
		allowedStyles: {
			span: { color: [...COLOR_PATTERNS] },
			mark: { 'background-color': [...COLOR_PATTERNS] }
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowedSchemesByTag: {},
		allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
		allowProtocolRelative: false,
		allowedIframeHostnames: [...VIDEO_EMBED_HOSTNAMES],
		allowIframeRelativeUrls: false,
		disallowedTagsMode: 'discard',
		enforceHtmlBoundary: false,
		nestingLimit: NESTING_LIMIT,
		transformTags: {
			a: transformLink,
			img: transformImage,
			iframe: transformFrame,
			input: transformCheckbox,
			ul: (tagName, attribs) => keepDataType(tagName, attribs, ['taskList']),
			li: transformListItem,
			ol: transformOrderedList,
			td: transformCell,
			th: transformCell,
			code: transformCode,
			span: (tagName, attribs) => transformSpan(attribs, math),
			div: (tagName, attribs) => transformDiv(attribs, math),
			mark: (tagName, attribs) => keepOnly(tagName, attribs, ['style'])
		},
		exclusiveFilter: (frame) => {
			if (frame.tag === 'img' || frame.tag === 'iframe') {
				return frame.attribs.src === undefined;
			}

			if (frame.tag === 'input') {
				return frame.attribs.type !== 'checkbox';
			}

			return false;
		}
	});

	return { html: sanitized, math };
}

function transformLink(tagName: string, attribs: Attributes): Tag {
	const href = attribs.href;

	if (href === undefined || !isAllowedHref(href)) {
		return { tagName: 'span', attribs: {} };
	}

	const result: Attributes = { href };

	if (attribs.title !== undefined && attribs.title !== '') {
		result.title = attribs.title;
	}

	if (isExternalHref(href)) {
		result.target = '_blank';
		result.rel = EXTERNAL_LINK_REL;
	}

	return { tagName: 'a', attribs: result };
}

function transformImage(tagName: string, attribs: Attributes): Tag {
	const src = attribs.src;

	if (src === undefined || parseMediaUrl(src) === null) {
		return { tagName, attribs: {} };
	}

	const result: Attributes = { src, alt: attribs.alt ?? '', loading: 'lazy', decoding: 'async' };
	const width = imageDimension(attribs.width ?? null);
	const height = imageDimension(attribs.height ?? null);

	if (width !== null && height !== null) {
		result.width = String(width);
		result.height = String(height);
	}

	return { tagName, attribs: result };
}

function transformFrame(tagName: string, attribs: Attributes): Tag {
	const reference = parseVideoEmbedUrl(attribs.src ?? '');

	if (reference === null) {
		return { tagName, attribs: {} };
	}

	return {
		tagName,
		attribs: {
			src: videoEmbedUrl(reference),
			title: VIDEO_PROVIDER_NAMES[reference.provider],
			loading: 'lazy',
			referrerpolicy: VIDEO_EMBED_REFERRER_POLICY,
			sandbox: VIDEO_EMBED_SANDBOX,
			allow: VIDEO_EMBED_ALLOW
		}
	};
}

function transformCheckbox(tagName: string, attribs: Attributes): Tag {
	if (attribs.type !== 'checkbox') {
		return { tagName, attribs: {} };
	}

	const result: Attributes = { type: 'checkbox', disabled: '' };

	if (attribs.checked !== undefined) {
		result.checked = '';
	}

	return { tagName, attribs: result };
}

function transformListItem(tagName: string, attribs: Attributes): Tag {
	if (attribs['data-type'] !== 'taskItem') {
		return { tagName, attribs: {} };
	}

	let checked = 'false';

	if (attribs['data-checked'] === 'true') {
		checked = 'true';
	}

	return { tagName, attribs: { 'data-type': 'taskItem', 'data-checked': checked } };
}

function transformOrderedList(tagName: string, attribs: Attributes): Tag {
	const result: Attributes = {};
	const start = attribs.start;
	const type = attribs.type;

	if (start !== undefined && START_PATTERN.test(start)) {
		result.start = String(Number(start));
	}

	if (type !== undefined && isOrderedListType(type)) {
		result.type = type;
	}

	return { tagName, attribs: result };
}

function transformCell(tagName: string, attribs: Attributes): Tag {
	const result: Attributes = {};

	for (const name of ['colspan', 'rowspan']) {
		const value = attribs[name];

		if (value !== undefined && SPAN_PATTERN.test(value) && Number(value) <= MAX_TABLE_SPAN) {
			result[name] = value;
		}
	}

	return { tagName, attribs: result };
}

function transformCode(tagName: string, attribs: Attributes): Tag {
	const className = attribs.class ?? '';

	if (className.startsWith(LANGUAGE_CLASS_PREFIX)) {
		const language = className.slice(LANGUAGE_CLASS_PREFIX.length);

		if (isCodeLanguage(language)) {
			return { tagName, attribs: { class: className } };
		}
	}

	return { tagName, attribs: {} };
}

function transformSpan(attribs: Attributes, math: MathSource[]): Tag {
	if (attribs['data-type'] === 'inline-math') {
		return mathPlaceholder('span', 'inline-math', attribs, math, false);
	}

	return keepOnly('span', attribs, ['class', 'style']);
}

function transformDiv(attribs: Attributes, math: MathSource[]): Tag {
	const type = attribs['data-type'];

	if (type === 'block-math') {
		return mathPlaceholder('div', 'block-math', attribs, math, true);
	}

	if (type === 'video-embed') {
		return { tagName: 'div', attribs: { 'data-type': 'video-embed' } };
	}

	return { tagName: 'div', attribs: {} };
}

function mathPlaceholder(
	tagName: string,
	type: string,
	attribs: Attributes,
	math: MathSource[],
	displayMode: boolean
): Tag {
	const index = math.push({ latex: attribs['data-latex'] ?? '', displayMode }) - 1;

	return { tagName, attribs: { 'data-type': type, 'data-math-index': String(index) } };
}

function keepDataType(tagName: string, attribs: Attributes, allowed: string[]): Tag {
	const type = attribs['data-type'];

	if (type !== undefined && allowed.includes(type)) {
		return { tagName, attribs: { 'data-type': type } };
	}

	return { tagName, attribs: {} };
}

function keepOnly(tagName: string, attribs: Attributes, names: string[]): Tag {
	const result: Attributes = {};

	for (const name of names) {
		const value = attribs[name];

		if (value !== undefined) {
			result[name] = value;
		}
	}

	return { tagName, attribs: result };
}
