import { Marked, type RendererObject } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { isCodeLanguage, lowlight } from '../../content/code-languages';
import type { DocsHeading, RenderedDocs } from '../../modules/interfaces/docs.interfaces';
import { escapeHtml } from '../content/render-math';
import { docsHref } from './docs-links';

type HighlightTree = ReturnType<typeof lowlight.highlight>;

type HighlightNode = HighlightTree['children'][number];

const CONTENTS_DEPTH = 3;

const HIGHLIGHT_CLASS = /^hljs-[a-z0-9_-]+$/;

const LANGUAGE_CLASS = /^language-[a-z0-9][a-z0-9_+#.-]*$/;

const REMOVED_HEADING_CHARACTERS = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;

export function renderDocs(markdown: string): RenderedDocs {
	const headings: DocsHeading[] = [];
	const usedIds = new Map<string, number>();
	let title = '';

	const renderer: RendererObject = {
		heading({ tokens, depth, text }) {
			const plainText = plainHeadingText(text);

			if (depth === 1 && title === '') {
				title = plainText;

				return '';
			}

			const id = uniqueHeadingId(usedIds, headingId(plainText));

			if (depth <= CONTENTS_DEPTH) {
				headings.push({ id, text: plainText, depth });
			}

			return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
		},
		link({ href, tokens }) {
			return `<a href="${escapeHtml(docsHref(href))}">${this.parser.parseInline(tokens)}</a>`;
		},
		code({ text, lang }) {
			return codeBlock(text, lang ?? '');
		},
		html({ text }) {
			return escapeHtml(text);
		}
	};
	const html = new Marked({ gfm: true, renderer }).parse(markdown, { async: false });

	return { title, headings, html: sanitizeDocsHtml(html) };
}

export function headingId(text: string): string {
	return text.toLowerCase().replace(REMOVED_HEADING_CHARACTERS, '').replaceAll(' ', '-');
}

function plainHeadingText(text: string): string {
	return text.replaceAll('`', '').replaceAll('**', '').trim();
}

function uniqueHeadingId(usedIds: Map<string, number>, base: string): string {
	const count = usedIds.get(base) ?? 0;

	usedIds.set(base, count + 1);

	if (count === 0) {
		return base;
	}

	return `${base}-${count}`;
}

function codeBlock(code: string, language: string): string {
	const name = language.trim().split(/\s+/, 1)[0].toLowerCase();

	if (name === '' || !isCodeLanguage(name)) {
		return `<pre><code>${escapeHtml(code)}</code></pre>\n`;
	}

	const tree = lowlight.highlight(name, code);

	return `<pre><code class="language-${name}">${tree.children.map(highlightNodeHtml).join('')}</code></pre>\n`;
}

function highlightNodeHtml(node: HighlightNode): string {
	if (node.type === 'text') {
		return escapeHtml(node.value);
	}

	if (node.type !== 'element') {
		return '';
	}

	const classNames = node.properties.className;
	let classes = '';

	if (Array.isArray(classNames)) {
		classes = classNames.filter((name) => typeof name === 'string').join(' ');
	}

	return `<span class="${escapeHtml(classes)}">${node.children.map(highlightNodeHtml).join('')}</span>`;
}

function sanitizeDocsHtml(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: [
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'p',
			'br',
			'hr',
			'strong',
			'em',
			'del',
			'blockquote',
			'ul',
			'ol',
			'li',
			'a',
			'code',
			'pre',
			'span',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td'
		],
		allowedAttributes: {
			h2: ['id'],
			h3: ['id'],
			h4: ['id'],
			h5: ['id'],
			h6: ['id'],
			a: ['href'],
			ol: ['start'],
			code: ['class'],
			span: ['class']
		},
		allowedClasses: {
			code: [LANGUAGE_CLASS],
			span: [HIGHLIGHT_CLASS]
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowedSchemesByTag: {},
		allowProtocolRelative: false,
		disallowedTagsMode: 'discard'
	});
}
