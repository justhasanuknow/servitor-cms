import { expect, test } from '@playwright/test';

test('pages get the security headers and a nonce-based CSP', async ({ request }) => {
	const response = await request.get('/panel/login');
	const headers = response.headers();
	const csp = headers['content-security-policy'];
	const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];

	expect(csp).toContain("default-src 'self'");
	expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
	expect(csp).toContain("style-src 'self' 'unsafe-inline'");
	expect(csp).toContain("img-src 'self' data:");
	expect(csp).toContain('frame-src https://www.youtube-nocookie.com https://player.vimeo.com');
	expect(csp).toContain("object-src 'none'");
	expect(csp).toContain("base-uri 'self'");
	expect(csp).toContain("form-action 'self'");
	expect(csp).toContain("frame-ancestors 'none'");
	expect(nonce).toBeDefined();
	expect(await response.text()).toContain(`nonce="${nonce}"`);
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	expect(headers['cross-origin-opener-policy']).toBe('same-origin');
	expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
	expect(headers['permissions-policy']).toContain('camera=()');
});

test('public reading pages ship without scripts', async ({ request }) => {
	const response = await request.get('/blog/en');
	const csp = response.headers()['content-security-policy'];

	expect(response.status()).toBe(200);
	expect(csp).toContain("script-src 'self';");
	expect(csp).not.toContain('nonce-');
	expect(await response.text()).not.toContain('<script');
});

test('endpoints get the security headers', async ({ request }) => {
	const response = await request.get('/healthz');
	const headers = response.headers();

	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
});
