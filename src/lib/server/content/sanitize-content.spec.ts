import { describe, expect, it } from 'vitest';
import { renderMathPlaceholders } from './render-math';
import { sanitizeContentHtml } from './sanitize-content';

const MEDIA_SRC = '/media/3f2504e0-4f89-41d3-9a0c-0305e82c3301/960.webp';

function clean(html: string): string {
	return sanitizeContentHtml(html).html;
}

describe('sanitizeContentHtml: script injection', () => {
	it.each([
		['<script>alert(1)</script><p>ok</p>', '<p>ok</p>'],
		['<style>body{display:none}</style><p>ok</p>', '<p>ok</p>'],
		['<p>ok<svg onload="alert(1)"><script>alert(1)</script></svg></p>', '<p>ok</p>'],
		['<math><mi xlink:href="javascript:alert(1)">x</mi></math>', 'x'],
		['<object data="evil.swf"></object><embed src="evil.swf">', ''],
		['<form action="https://evil.example"><input type="text" name="q"></form>', ''],
		['<base href="https://evil.example/"><p>ok</p>', '<p>ok</p>'],
		['<meta http-equiv="refresh" content="0;url=https://evil.example">', ''],
		['<template><script>alert(1)</script></template>', '']
	])('cleans %s', (dirty, expected) => {
		expect(clean(dirty)).toBe(expected);
	});
});

describe('sanitizeContentHtml: event handler attributes', () => {
	it('removes every event handler', () => {
		const result = clean(
			`<p onclick="alert(1)">a</p><img src="${MEDIA_SRC}" alt="" onerror="alert(1)"><span onmouseover="alert(1)" style="color:#fff">b</span>`
		);

		expect(result).not.toMatch(/\son[a-z]+=/i);
		expect(result).toContain('<p>a</p>');
		expect(result).toContain('<span style="color:#fff">b</span>');
	});
});

describe('sanitizeContentHtml: links', () => {
	it.each([
		'<a href="javascript:alert(1)">x</a>',
		'<a href="JaVaScRiPt:alert(1)">x</a>',
		'<a href="&#106;avascript:alert(1)">x</a>',
		'<a href="java&#x09;script:alert(1)">x</a>',
		'<a href="data:text/html,<script>alert(1)</script>">x</a>',
		'<a href="vbscript:msgbox(1)">x</a>',
		'<a href="//evil.example">x</a>'
	])('neutralizes %s', (dirty) => {
		expect(clean(dirty)).toBe('<span>x</span>');
	});

	it('forces rel on external links and strips targets elsewhere', () => {
		expect(clean('<a href="https://example.com" target="_self" rel="opener">x</a>')).toBe(
			'<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>'
		);
		expect(clean('<a href="/local" target="_blank" class="button">x</a>')).toBe(
			'<a href="/local">x</a>'
		);
	});
});

describe('sanitizeContentHtml: malicious style values', () => {
	it.each([
		'<span style="color: red">x</span>',
		'<span style="color: expression(alert(1))">x</span>',
		'<span style="background-image: url(javascript:alert(1))">x</span>',
		'<span style="color: #fff; position: fixed; top: 0">x</span>',
		'<span style="behavior: url(evil.htc)">x</span>',
		'<p style="color:#fff">x</p>'
	])('keeps only valid colors in %s', (dirty) => {
		expect(clean(dirty)).toMatch(/^<(span|p)( style="color:#fff")?>x<\/(span|p)>$/);
	});

	it('keeps only background colors on highlights', () => {
		expect(clean('<mark style="background-color: #ff000050; color: inherit">x</mark>')).toBe(
			'<mark style="background-color:#ff000050">x</mark>'
		);
	});
});

describe('sanitizeContentHtml: iframes and images', () => {
	it.each([
		'<iframe src="https://evil.example/embed/x"></iframe>',
		'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
		'<iframe src="javascript:alert(1)"></iframe>',
		'<iframe srcdoc="<script>alert(1)</script>"></iframe>',
		'<iframe src="/panel"></iframe>'
	])('removes %s', (dirty) => {
		expect(clean(dirty)).toBe('');
	});

	it('forces the fixed sandbox and allow attributes on allowlisted embeds', () => {
		const result = clean(
			'<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" sandbox="allow-top-navigation allow-scripts" allow="camera; microphone" onload="alert(1)"></iframe>'
		);

		expect(result).toContain(
			'sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"'
		);
		expect(result).toContain('allow="encrypted-media; picture-in-picture; fullscreen"');
		expect(result).not.toContain('allow-top-navigation');
		expect(result).not.toContain('camera');
		expect(result).not.toContain('onload');
	});

	it.each([
		'<img src="https://evil.example/pixel.png">',
		'<img src="data:image/png;base64,iVBORw0KGgo=">',
		'<img src="//evil.example/pixel.png">',
		'<img src="/panel/users">',
		'<img srcset="https://evil.example/a.png 1x">'
	])('removes the image %s', (dirty) => {
		expect(clean(dirty)).toBe('');
	});
});

describe('sanitizeContentHtml: classes and data attributes', () => {
	it('keeps only highlight and language classes', () => {
		expect(
			clean(
				'<pre class="evil"><code class="language-javascript extra"><span class="hljs-keyword fixed inset-0">x</span></code></pre>'
			)
		).toBe('<pre><code><span class="hljs-keyword">x</span></code></pre>');
		expect(clean('<code class="language-javascript">x</code>')).toBe(
			'<code class="language-javascript">x</code>'
		);
	});

	it('assigns math indexes itself and drops injected ones', () => {
		const result = sanitizeContentHtml(
			'<span data-type="inline-math" data-latex="x^2" data-math-index="7"></span><span data-math-index="3">y</span><div data-type="block-math" data-latex="\\frac12"></div>'
		);

		expect(result.html).toBe(
			'<span data-type="inline-math" data-math-index="0"></span><span>y</span><div data-type="block-math" data-math-index="1"></div>'
		);
		expect(result.math).toEqual([
			{ latex: 'x^2', displayMode: false },
			{ latex: String.raw`\frac12`, displayMode: true }
		]);
	});
});

describe('renderMathPlaceholders', () => {
	it('replaces only canonical placeholders', () => {
		const html = renderMathPlaceholders(
			'<span data-type="inline-math" data-math-index="0"></span><p>&lt;span data-type="inline-math" data-math-index="0"&gt;&lt;/span&gt;</p>',
			[{ latex: 'a<b', displayMode: false }]
		);

		expect(
			html.startsWith(
				'<span data-type="inline-math" data-latex="a&lt;b"><span class="katex">'
			)
		).toBe(true);
		expect(html).toContain(
			'<p>&lt;span data-type="inline-math" data-math-index="0"&gt;&lt;/span&gt;</p>'
		);
	});

	it('drops placeholders without a matching source', () => {
		expect(
			renderMathPlaceholders('<div data-type="block-math" data-math-index="4"></div>', [])
		).toBe('');
		expect(
			renderMathPlaceholders('<div data-type="block-math" data-math-index="0"></div>', [
				{ latex: 'x', displayMode: false }
			])
		).toBe('');
	});
});
