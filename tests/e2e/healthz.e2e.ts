import { expect, test } from '@playwright/test';

test('reports a healthy status without caching', async ({ request }) => {
	const response = await request.get('/healthz');

	expect(response.status()).toBe(200);
	expect(response.headers()['cache-control']).toBe('no-store');
	expect(await response.json()).toEqual({ status: 'ok' });
});
