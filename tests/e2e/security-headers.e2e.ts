import { expect, test } from '@playwright/test';
import { createUser, newClient, signIn, uniqueEmail } from './support';

const PASSWORD = 'e2e-Headers-Passphrase-2026';

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
	expect(csp).toContain("base-uri 'none'");
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

test('text responses declare UTF-8', async ({ request }) => {
	const page = await request.get('/panel/login');
	const robots = await request.get('/robots.txt');

	expect(page.headers()['content-type']).toBe('text/html; charset=utf-8');
	expect(robots.headers()['content-type']).toBe('text/plain; charset=utf-8');
});

test('account link pages never send their URL to other sites as a referrer', async ({
	request
}) => {
	const response = await request.get('/panel/invite/not-a-real-token');

	expect(response.headers()['referrer-policy']).toBe('same-origin');
	expect(response.headers()['cache-control']).toBe('no-store');
});

test('TRACE is not supported', async ({ request }) => {
	const response = await request.fetch('/panel/login', { method: 'TRACE' });

	expect(response.status()).toBe(405);
});

test('signing out asks the browser to clear cached data', async ({ browser }) => {
	const email = uniqueEmail('sign-out');

	await createUser(browser, {
		name: 'Sign Out Check',
		email,
		role: 'Author',
		password: PASSWORD
	});

	const page = await newClient(browser);

	await signIn(page, email, PASSWORD);
	await expect(page).toHaveURL(/\/panel$/);

	const response = await page.request.post('/panel/logout', { maxRedirects: 0 });

	expect(response.status()).toBe(303);
	expect(response.headers()['location']).toBe('/panel/login');
	expect(response.headers()['clear-site-data']).toBe('"cache", "storage"');
	await page.context().close();
});

test('static build assets get the baseline security headers', async ({ request }) => {
	const html = await (await request.get('/panel/login')).text();
	const asset = /\/_app\/immutable\/[^"']+\.js/.exec(html)?.[0];

	expect(asset).toBeDefined();

	const response = await request.get(asset ?? '');
	const headers = response.headers();

	expect(response.status()).toBe(200);
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
	expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('endpoints cannot be framed either', async ({ request }) => {
	const response = await request.get('/healthz');

	expect(response.headers()['content-security-policy']).toBe(
		"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
	);
});
