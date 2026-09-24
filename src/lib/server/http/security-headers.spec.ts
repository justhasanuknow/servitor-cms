import { describe, expect, it } from 'vitest';
import { applyPanelCachePolicy, applySecurityHeaders } from './security-headers';

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

		applySecurityHeaders(headers, false);

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

		applySecurityHeaders(headers, true);

		expect(headers.get('strict-transport-security')).toBe(
			'max-age=63072000; includeSubDomains'
		);
	});

	it('keeps features needed by video embeds available', () => {
		const headers = new Headers();

		applySecurityHeaders(headers, true);

		expect(headers.get('permissions-policy')).not.toContain('fullscreen');
		expect(headers.get('permissions-policy')).not.toContain('encrypted-media');
	});
});
