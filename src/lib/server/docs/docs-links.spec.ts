import { describe, expect, it } from 'vitest';
import { docsFileHref, docsHref, docsSlug } from './docs-links';

describe('docsSlug', () => {
	it('uses the lower-case file name without the extension', () => {
		expect(docsSlug('installation.md')).toBe('installation');
		expect(docsSlug('SECURITY-REVIEW.md')).toBe('security-review');
	});
});

describe('docsFileHref', () => {
	it('serves the index at the documentation root', () => {
		expect(docsFileHref('README.md')).toBe('/docs');
		expect(docsFileHref('api.md')).toBe('/docs/api');
	});
});

describe('docsHref', () => {
	it.each([
		['webhooks.md', '/docs/webhooks'],
		['webhooks.md#verifying-the-signature', '/docs/webhooks#verifying-the-signature'],
		['README.md#reference', '/docs#reference'],
		['#events', '#events'],
		['https://example.com/readme.md', 'https://example.com/readme.md'],
		['../SECURITY.md', '../SECURITY.md'],
		['folder/page.md', 'folder/page.md']
	])('turns %s into %s', (href, expected) => {
		expect(docsHref(href)).toBe(expected);
	});
});
