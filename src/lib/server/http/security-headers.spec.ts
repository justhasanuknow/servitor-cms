import { describe, expect, it } from 'vitest';
import { applySecurityHeaders } from './security-headers';

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
