import { describe, expect, it } from 'vitest';
import {
	applyPanelCachePolicy,
	applySecurityHeaders,
	RESOURCE_CONTENT_SECURITY_POLICY
} from './security-headers';

describe('applyPanelCachePolicy', () => {
	it('keeps panel responses out of every cache', () => {
		const panel = new Headers();
		const nested = new Headers();

		applyPanelCachePolicy(panel, '/panel');
		applyPanelCachePolicy(nested, '/panel/users');

		expect(panel.get('cache-control')).toBe('no-store');
		expect(nested.get('cache-control')).toBe('no-store');
	});

	it('leaves other routes and explicit policies alone', () => {
		const publicPage = new Headers();
		const explicit = new Headers({ 'cache-control': 'private, max-age=0' });

		applyPanelCachePolicy(publicPage, '/panelists');
		applyPanelCachePolicy(explicit, '/panel/users');

		expect(publicPage.has('cache-control')).toBe(false);
		expect(explicit.get('cache-control')).toBe('private, max-age=0');
	});
});

describe('applySecurityHeaders', () => {
	it('sets the baseline headers in every environment', () => {
		const headers = new Headers();

		applySecurityHeaders(headers, false, '/panel');

		expect(headers.get('x-content-type-options')).toBe('nosniff');
		expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
		expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
		expect(headers.get('permissions-policy')).toContain('camera=()');
		expect(headers.get('permissions-policy')).toContain('microphone=()');
		expect(headers.get('permissions-policy')).toContain('geolocation=()');
		expect(headers.has('strict-transport-security')).toBe(false);
	});

	it('adds HSTS in production', () => {
		const headers = new Headers();

		applySecurityHeaders(headers, true, '/');

		expect(headers.get('strict-transport-security')).toBe(
			'max-age=63072000; includeSubDomains'
		);
	});

	it('gives responses without a policy a restrictive CSP and keeps page policies', () => {
		const endpoint = new Headers();
		const page = new Headers({ 'content-security-policy': "default-src 'self'" });

		applySecurityHeaders(endpoint, true, '/healthz');
		applySecurityHeaders(page, true, '/panel/login');

		expect(endpoint.get('content-security-policy')).toBe(RESOURCE_CONTENT_SECURITY_POLICY);
		expect(RESOURCE_CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
		expect(page.get('content-security-policy')).toBe("default-src 'self'");
	});

	it('keeps features needed by video embeds available', () => {
		const headers = new Headers();

		applySecurityHeaders(headers, true, '/');

		expect(headers.get('permissions-policy')).not.toContain('fullscreen');
		expect(headers.get('permissions-policy')).not.toContain('encrypted-media');
	});
});

describe('account link pages', () => {
	it('never send their token-bearing URL to other sites as a referrer', () => {
		for (const pathname of [
			'/panel/invite/abc',
			'/panel/reset-password/abc',
			'/panel/verify-email/abc/__data.json'
		]) {
			const headers = new Headers();

			applySecurityHeaders(headers, true, pathname);

			expect(headers.get('referrer-policy')).toBe('same-origin');
		}
	});

	it('keep the default policy elsewhere', () => {
		const headers = new Headers();

		applySecurityHeaders(headers, true, '/panel/invitees');

		expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});
});

describe('text responses', () => {
	it('declare UTF-8 when the framework leaves the charset out', () => {
		for (const contentType of ['text/html', 'text/plain', 'application/xml', 'image/svg+xml']) {
			const headers = new Headers({ 'content-type': contentType });

			applySecurityHeaders(headers, true, '/');

			expect(headers.get('content-type')).toBe(`${contentType}; charset=utf-8`);
		}
	});

	it('keep an explicit charset and leave binary types alone', () => {
		const explicit = new Headers({ 'content-type': 'text/plain; Charset=UTF-8' });
		const image = new Headers({ 'content-type': 'image/webp' });
		const json = new Headers({ 'content-type': 'application/json' });

		applySecurityHeaders(explicit, true, '/');
		applySecurityHeaders(image, true, '/');
		applySecurityHeaders(json, true, '/');

		expect(explicit.get('content-type')).toBe('text/plain; Charset=UTF-8');
		expect(image.get('content-type')).toBe('image/webp');
		expect(json.get('content-type')).toBe('application/json');
	});
});
