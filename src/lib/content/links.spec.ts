import { describe, expect, it } from 'vitest';
import { MAX_HREF_LENGTH } from '../constants/content';
import { isAllowedHref, isExternalHref } from './links';

describe('isAllowedHref', () => {
	it.each([
		'https://example.com',
		'http://example.com/path?query=1#hash',
		'HTTPS://EXAMPLE.COM',
		'mailto:someone@example.com',
		'/blog/post',
		'#section',
		'?page=2',
		'relative/path',
		'./a:b'
	])('allows %s', (href) => {
		expect(isAllowedHref(href)).toBe(true);
	});

	it.each([
		'javascript:alert(1)',
		'JaVaScRiPt:alert(1)',
		' javascript:alert(1)',
		'java\tscript:alert(1)',
		'java\nscript:alert(1)',
		'\u0000javascript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:msgbox(1)',
		'file:///etc/passwd',
		'ftp://example.com',
		'tel:+123',
		'//evil.example.com',
		'/\\evil.example.com',
		'https:evil.example.com',
		'https://',
		'mailto:',
		'https://exa mple.com',
		'https://example.com/\u0085',
		''
	])('rejects %j', (href) => {
		expect(isAllowedHref(href)).toBe(false);
	});

	it('rejects overly long links', () => {
		expect(isAllowedHref(`https://example.com/${'a'.repeat(MAX_HREF_LENGTH)}`)).toBe(false);
	});
});

describe('isExternalHref', () => {
	it('treats absolute http and https links as external', () => {
		expect(isExternalHref('https://example.com')).toBe(true);
		expect(isExternalHref('http://example.com')).toBe(true);
	});

	it('treats relative and mailto links as internal', () => {
		expect(isExternalHref('/blog')).toBe(false);
		expect(isExternalHref('#top')).toBe(false);
		expect(isExternalHref('mailto:a@example.com')).toBe(false);
	});
});
