import { describe, expect, it } from 'vitest';
import { headingId, renderDocs } from './render-docs';

describe('renderDocs', () => {
	it('takes the first top-level heading as the title without rendering it', () => {
		const rendered = renderDocs('# Getting started\n\nWelcome to the documentation.\n');

		expect(rendered.title).toBe('Getting started');
		expect(rendered.html).not.toContain('<h1');
		expect(rendered.html).toContain('<p>Welcome to the documentation.</p>');
	});

	it('gives headings unique ids and lists the second and third level', () => {
		const rendered = renderDocs(
			[
				'# Title',
				'## 1. Get the code',
				'### `ORIGIN`',
				'#### Details',
				'## Roles & **permissions**',
				'## Roles & **permissions**'
			].join('\n\n')
		);

		expect(rendered.headings).toEqual([
			{ id: '1-get-the-code', text: '1. Get the code', depth: 2 },
			{ id: 'origin', text: 'ORIGIN', depth: 3 },
			{ id: 'roles--permissions', text: 'Roles & permissions', depth: 2 },
			{ id: 'roles--permissions-1', text: 'Roles & permissions', depth: 2 }
		]);
		expect(rendered.html).toContain('<h3 id="origin"><code>ORIGIN</code></h3>');
		expect(rendered.html).toContain('<h4 id="details">Details</h4>');
		expect(rendered.html).toContain(
			'<h2 id="roles--permissions">Roles &amp; <strong>permissions</strong></h2>'
		);
	});

	it('points links between documentation files to their pages', () => {
		const rendered = renderDocs(
			[
				'[API errors](api.md#errors)',
				'[Review](SECURITY-REVIEW.md)',
				'[Overview](README.md)',
				'[Section](#events)',
				'[Site](https://example.com/guide?a=1&b=2)',
				'[Mail](mailto:security@example.com)'
			].join('\n\n')
		);

		expect(rendered.html).toContain('<a href="/docs/api#errors">API errors</a>');
		expect(rendered.html).toContain('<a href="/docs/security-review">Review</a>');
		expect(rendered.html).toContain('<a href="/docs">Overview</a>');
		expect(rendered.html).toContain('<a href="#events">Section</a>');
		expect(rendered.html).toContain('<a href="https://example.com/guide?a=1&amp;b=2">Site</a>');
		expect(rendered.html).toContain('<a href="mailto:security@example.com">Mail</a>');
	});

	it('removes links with unsafe schemes', () => {
		const rendered = renderDocs('[Run](javascript:alert(1)) and [data](data:text/html,x)');

		expect(rendered.html).not.toContain('javascript:');
		expect(rendered.html).not.toContain('data:');
		expect(rendered.html).toContain('Run');
	});

	it('shows raw HTML as text', () => {
		const rendered = renderDocs(
			'<script>alert(1)</script>\n\nSome <b onclick="x()">bold</b> text.\n'
		);

		expect(rendered.html).not.toContain('<script');
		expect(rendered.html).not.toContain('<b');
		expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(rendered.html).toContain('&lt;b onclick=');
	});

	it('highlights code in known languages and escapes other code', () => {
		const rendered = renderDocs(
			'```js\nconst limit = 10;\n```\n\n```unknown-language\n<b>plain</b>\n```\n\n```\n<i>none</i>\n```\n'
		);

		expect(rendered.html).toContain('<pre><code class="language-js">');
		expect(rendered.html).toContain('<span class="hljs-keyword">const</span>');
		expect(rendered.html).toContain('<pre><code>&lt;b&gt;plain&lt;/b&gt;');
		expect(rendered.html).toContain('<pre><code>&lt;i&gt;none&lt;/i&gt;');
	});

	it('keeps tables, lists and inline formatting', () => {
		const rendered = renderDocs(
			'| Name | Value |\n| ---- | ----- |\n| `a` | *b* |\n\n1. First\n2. **Second**\n\n> Note\n'
		);

		expect(rendered.html).toContain('<th>Name</th>');
		expect(rendered.html).toContain('<td><code>a</code></td>');
		expect(rendered.html).toContain('<td><em>b</em></td>');
		expect(rendered.html).toContain('<li><strong>Second</strong></li>');
		expect(rendered.html).toContain('<blockquote>');
	});

	it('drops images', () => {
		const rendered = renderDocs('![Diagram](https://example.com/diagram.png)');

		expect(rendered.html).not.toContain('<img');
	});
});

describe('headingId', () => {
	it.each([
		['Getting started', 'getting-started'],
		['1. Get the code', '1-get-the-code'],
		['Roles & permissions', 'roles--permissions'],
		['What’s new?', 'whats-new'],
		['snake_case and kebab-case', 'snake_case-and-kebab-case'],
		['Çalışma dili', 'çalışma-dili']
	])('turns %s into %s', (text, id) => {
		expect(headingId(text)).toBe(id);
	});
});
