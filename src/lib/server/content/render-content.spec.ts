import { describe, expect, it } from 'vitest';
import {
	MAX_CONTENT_CHILDREN,
	MAX_CONTENT_DEPTH,
	MAX_CONTENT_JSON_LENGTH,
	MAX_CONTENT_NODES
} from '../../constants/content';
import { renderContent, renderContentDocument } from './render-content';
import type { RenderedContent } from './render-content.interfaces';

const MEDIA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const MEDIA_SRC = `/media/${MEDIA_ID}/1600.webp`;

function doc(...content: unknown[]) {
	return { type: 'doc', content };
}

function paragraph(...content: unknown[]) {
	return { type: 'paragraph', content };
}

function text(value: string, marks: unknown[] = []) {
	if (marks.length === 0) {
		return { type: 'text', text: value };
	}

	return { type: 'text', text: value, marks };
}

function link(href: string) {
	return { type: 'link', attrs: { href, target: null, rel: null, class: null, title: null } };
}

function image(attrs: Record<string, unknown>) {
	return {
		type: 'image',
		attrs: { src: MEDIA_SRC, alt: '', width: null, height: null, ...attrs }
	};
}

function rendered(value: unknown): RenderedContent {
	const result = renderContentDocument(value);

	if (result.status !== 'rendered') {
		throw new Error(`Expected the document to render, got ${result.status}`);
	}

	return result.content;
}

function statusOf(value: unknown): string {
	return renderContentDocument(value).status;
}

function nested(depth: number): unknown {
	let node: unknown = paragraph(text('deep'));

	for (let level = 0; level < depth; level += 1) {
		node = { type: 'blockquote', content: [node] };
	}

	return doc(node);
}

describe('rendering the enabled features', () => {
	it('renders headings, marks, lists, tables, code, math, images and embeds', () => {
		const content = rendered(
			doc(
				{ type: 'heading', attrs: { level: 3 }, content: [text('Title')] },
				paragraph(
					text('bold', [{ type: 'bold' }]),
					text(' italic', [{ type: 'italic' }]),
					text(' underline', [{ type: 'underline' }]),
					text(' strike', [{ type: 'strike' }]),
					text(' red', [{ type: 'textStyle', attrs: { color: '#b30707' } }]),
					text(' marked', [{ type: 'highlight', attrs: { color: '#c4c40450' } }]),
					{ type: 'inlineMath', attrs: { latex: 'x^2' } }
				),
				{ type: 'blockquote', content: [paragraph(text('quote'))] },
				{
					type: 'bulletList',
					content: [{ type: 'listItem', content: [paragraph(text('item'))] }]
				},
				{
					type: 'taskList',
					content: [
						{
							type: 'taskItem',
							attrs: { checked: true },
							content: [paragraph(text('task'))]
						}
					]
				},
				{
					type: 'codeBlock',
					attrs: { language: 'typescript' },
					content: [text('const answer: number = 42;')]
				},
				{ type: 'blockMath', attrs: { latex: String.raw`\sum_{i=1}^{n} i` } },
				image({ alt: 'Diagram', width: 800, height: 600 }),
				{ type: 'videoEmbed', attrs: { provider: 'youtube', videoId: 'dQw4w9WgXcQ' } },
				{
					type: 'table',
					content: [
						{
							type: 'tableRow',
							content: [
								{
									type: 'tableCell',
									attrs: { colspan: 2, rowspan: 1 },
									content: [paragraph(text('cell'))]
								}
							]
						}
					]
				}
			)
		);

		expect(content.html).toContain('<h3>Title</h3>');
		expect(content.html).toContain('<strong>bold</strong>');
		expect(content.html).toContain('<em> italic</em>');
		expect(content.html).toContain('<u> underline</u>');
		expect(content.html).toContain('<s> strike</s>');
		expect(content.html).toContain('<span style="color:#b30707"> red</span>');
		expect(content.html).toContain('<mark style="background-color:#c4c40450"> marked</mark>');
		expect(content.html).toContain('<blockquote><p>quote</p></blockquote>');
		expect(content.html).toContain('<li data-type="taskItem" data-checked="true">');
		expect(content.html).toContain('<input type="checkbox" disabled checked />');
		expect(content.html).toContain('<code class="language-typescript">');
		expect(content.html).toContain('<span class="hljs-keyword">const</span>');
		expect(content.html).toContain(
			'data-type="inline-math" data-latex="x^2"><span class="katex">'
		);
		expect(content.html).toContain('<span class="katex-display">');
		expect(content.html).toContain(
			`<img src="${MEDIA_SRC}" alt="Diagram" loading="lazy" decoding="async" width="800" height="600" />`
		);
		expect(content.html).toContain(
			'<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="YouTube"'
		);
		expect(content.html).toContain('<td colspan="2" rowspan="1"><p>cell</p></td>');
		expect(content.mediaIds).toEqual([MEDIA_ID]);
		expect(content.text).toContain('Title');
		expect(content.readingTimeMinutes).toBe(1);
		expect(JSON.parse(content.json)).toMatchObject({ type: 'doc' });
	});

	it('adds rel and target to external links only', () => {
		const content = rendered(
			doc(
				paragraph(
					text('external', [link('https://example.com/a')]),
					text(' internal', [link('/blog/post')]),
					text(' mail', [link('mailto:hello@example.com')])
				)
			)
		);

		expect(content.html).toContain(
			'<a href="https://example.com/a" target="_blank" rel="noopener noreferrer nofollow">external</a>'
		);
		expect(content.html).toContain('<a href="/blog/post"> internal</a>');
		expect(content.html).toContain('<a href="mailto:hello@example.com"> mail</a>');
	});

	it('ignores link target, rel and class values sent by the client', () => {
		const content = rendered(
			doc(
				paragraph(
					text('link', [
						{
							type: 'link',
							attrs: {
								href: '/about',
								target: '_top',
								rel: 'opener',
								class: 'evil',
								title: 'About'
							}
						}
					])
				)
			)
		);

		expect(content.html).toContain('<a href="/about" title="About">link</a>');
	});
});

describe('XSS corpus: script injection', () => {
	it('escapes script tags in text', () => {
		const content = rendered(doc(paragraph(text('<script>alert(1)</script>'))));

		expect(content.html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
	});

	it('escapes markup in code blocks', () => {
		const content = rendered(
			doc({
				type: 'codeBlock',
				attrs: { language: null },
				content: [text('</code></pre><script>alert(1)</script>')]
			})
		);

		expect(content.html).not.toMatch(/<script/i);
		expect(content.html).not.toMatch(/<\/code><\/pre></);
		expect(content.html).toContain('&lt;');
	});

	it('escapes markup in image alt text', () => {
		const content = rendered(
			doc(image({ alt: '"><script>alert(1)</script><img src=x onerror=alert(1)>' }))
		);

		expect(content.html).not.toContain('<script>');
		expect(content.html).not.toContain('<img src=x');
		expect(content.html).toContain('alt="&quot;&gt;&lt;script&gt;');
	});

	it('renders LaTeX safely', () => {
		const content = rendered(
			doc(
				paragraph({
					type: 'inlineMath',
					attrs: { latex: '</span><script>alert(1)</script>' }
				}),
				{ type: 'blockMath', attrs: { latex: String.raw`\href{javascript:alert(1)}{x}` } }
			)
		);

		expect(content.html).not.toContain('<script>');
		expect(content.html).not.toContain('href="javascript');
		expect(content.html).not.toMatch(/<a\s/);
	});

	it.each([
		{ type: 'script', content: [text('alert(1)')] },
		{ type: 'html', attrs: { html: '<script>alert(1)</script>' } },
		{ type: 'rawHtml', content: [text('<b>x</b>')] },
		{ type: 'iframe', attrs: { src: 'https://evil.example' } },
		{ type: 'audio', attrs: { src: '/media/a.mp3' } },
		{ type: 'video', attrs: { src: '/media/a.mp4' } },
		{ type: 'horizontalRule' },
		{ type: 'heading', attrs: { level: 1 }, content: [text('h1')] },
		{ type: 'heading', attrs: { level: 5 }, content: [text('h5')] }
	])('rejects the unknown or disabled node %j', (node) => {
		expect(statusOf(doc(node))).toBe('invalid');
	});

	it.each([
		{ type: 'code' },
		{ type: 'subscript' },
		{ type: 'superscript' },
		{ type: 'script' },
		{ type: 'fontSize', attrs: { size: '100px' } }
	])('rejects the unknown or disabled mark %j', (mark) => {
		expect(statusOf(doc(paragraph(text('x', [mark]))))).toBe('invalid');
	});
});

describe('XSS corpus: event handler attributes', () => {
	it.each([
		image({ onerror: 'alert(1)' }),
		{ type: 'paragraph', attrs: { onclick: 'alert(1)' }, content: [text('x')] },
		{ type: 'heading', attrs: { level: 2, onmouseover: 'alert(1)' }, content: [text('x')] },
		{
			type: 'videoEmbed',
			attrs: { provider: 'youtube', videoId: 'dQw4w9WgXcQ', onload: 'alert(1)' }
		},
		{ type: 'blockMath', attrs: { latex: 'x', onclick: 'alert(1)' } },
		{ type: 'paragraph', content: [text('x')], onclick: 'alert(1)' }
	])('rejects %j', (node) => {
		expect(statusOf(doc(node))).toBe('invalid');
	});

	it('rejects extra link attributes', () => {
		const mark = {
			type: 'link',
			attrs: {
				href: '/a',
				target: null,
				rel: null,
				class: null,
				title: null,
				onclick: 'alert(1)'
			}
		};

		expect(statusOf(doc(paragraph(text('x', [mark]))))).toBe('invalid');
	});
});

describe('XSS corpus: javascript and data URLs', () => {
	it.each([
		'javascript:alert(1)',
		'JAVASCRIPT:alert(1)',
		' javascript:alert(1)',
		'java\tscript:alert(1)',
		'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
		'vbscript:msgbox(1)',
		'//evil.example.com/path'
	])('rejects links to %j', (href) => {
		expect(statusOf(doc(paragraph(text('x', [link(href)]))))).toBe('invalid');
	});
});

describe('XSS corpus: malicious style values', () => {
	it.each([
		'red; background: url(javascript:alert(1))',
		'expression(alert(1))',
		'url(https://evil.example/track.png)',
		'#fff;position:fixed',
		'var(--x)',
		'red'
	])('rejects the text color %j', (color) => {
		expect(statusOf(doc(paragraph(text('x', [{ type: 'textStyle', attrs: { color } }]))))).toBe(
			'invalid'
		);
	});

	it('rejects malicious highlight colors', () => {
		const mark = { type: 'highlight', attrs: { color: 'javascript:alert(1)' } };

		expect(statusOf(doc(paragraph(text('x', [mark]))))).toBe('invalid');
	});
});

describe('XSS corpus: iframes and external images', () => {
	it.each([
		{ provider: 'dailymotion', videoId: 'x7tgad0' },
		{ provider: 'youtube', videoId: 'dQw4w9WgXcQ" onload="alert(1)' },
		{ provider: 'youtube', videoId: '../../evil' },
		{ provider: 'vimeo', videoId: 'https://evil.example' }
	])('rejects the embed %j', (attrs) => {
		expect(statusOf(doc({ type: 'videoEmbed', attrs }))).toBe('invalid');
	});

	it.each([
		'https://evil.example/image.png',
		'http://127.0.0.1/image.png',
		'//evil.example/image.png',
		'data:image/png;base64,iVBORw0KGgo=',
		'data:image/svg+xml,<svg onload=alert(1)>',
		'javascript:alert(1)',
		`/media/${MEDIA_ID}/../../../etc/passwd`,
		`/media/${MEDIA_ID}/1600.svg`
	])('rejects the image source %j', (src) => {
		expect(statusOf(doc(image({ src })))).toBe('invalid');
	});
});

describe('malformed Tiptap JSON', () => {
	it.each(['', 'not json', '{"type":"doc"', '[]', 'null', '42'])(
		'rejects the JSON text %j',
		(json) => {
			expect(renderContent(json).status).toBe('invalid');
		}
	);

	it.each([
		null,
		{},
		{ type: 'paragraph', content: [] },
		{ type: 'doc' },
		{ type: 'doc', content: 'text' },
		{ type: 'doc', content: [], extra: true },
		doc({ type: 'paragraph', content: [{ type: 'text' }] }),
		doc({ type: 'paragraph', content: [{ type: 'text', text: '' }] }),
		doc({ type: 'paragraph', content: [{ type: 'text', text: 42 }] }),
		doc(paragraph(paragraph(text('nested paragraph')))),
		doc(text('text directly in the document')),
		doc({ type: 'bulletList', content: [paragraph(text('not a list item'))] }),
		doc({
			type: 'codeBlock',
			attrs: { language: null },
			content: [text('marked', [{ type: 'bold' }])]
		}),
		doc({ type: 'codeBlock', attrs: { language: 'klingon' }, content: [text('x')] }),
		doc({ type: 'heading', attrs: { level: '2' }, content: [text('x')] }),
		doc({ type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('x'))] }),
		doc({ type: 'image', attrs: { src: MEDIA_SRC } }),
		doc({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [] })
	])('rejects the document %j', (value) => {
		expect(statusOf(value)).toBe('invalid');
	});

	it('rejects documents that are nested too deeply', () => {
		expect(statusOf(nested(MAX_CONTENT_DEPTH + 5))).toBe('too_large');
	});

	it('rejects documents with too many nodes', () => {
		const words = [
			text('a'),
			text('b', [{ type: 'bold' }]),
			text('c'),
			text('d', [{ type: 'bold' }])
		];
		const paragraphs = Array.from({ length: Math.ceil(MAX_CONTENT_NODES / words.length) }, () =>
			paragraph(...words)
		);

		expect(statusOf({ type: 'doc', content: paragraphs })).toBe('too_large');
	});

	it('rejects nodes with too many children', () => {
		const paragraphs = Array.from({ length: MAX_CONTENT_CHILDREN + 1 }, () => ({
			type: 'paragraph'
		}));

		expect(statusOf({ type: 'doc', content: paragraphs })).toBe('invalid');
	});

	it('rejects oversized JSON before parsing it', () => {
		expect(renderContent(' '.repeat(MAX_CONTENT_JSON_LENGTH + 1)).status).toBe('too_large');
	});

	it('accepts an empty document', () => {
		const content = rendered(doc({ type: 'paragraph' }));

		expect(content.html).toBe('<p></p>');
		expect(content.text).toBe('');
		expect(content.readingTimeMinutes).toBe(0);
	});
});
