import { expect, test } from '@playwright/test';
import { E2E_FOUNDER } from '../../playwright.env';
import { authorPage } from './posts-support';
import { confirmedAction, newClient } from './support';

test('staff create an API key, use it and revoke it', async ({ browser, request }) => {
	const founder = await newClient(browser, true);
	const name = `Website ${Date.now()}`;

	await confirmedAction(
		founder,
		async () => {
			await founder.goto('/panel/api-keys');
			await founder.getByLabel('Name').fill(name);
			await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
			await founder.getByRole('button', { name: 'Create key' }).click();
		},
		`The key ${name} was created.`
	);

	const key = await founder.getByTestId('copy-field').inputValue();

	expect(key).toMatch(/^svt_[A-Za-z0-9_-]{43}$/);
	await expect(founder.getByTestId('api-key-list')).toContainText(name);
	await expect(founder.getByTestId('api-key-list')).toContainText(`${key.slice(0, 12)}…`);

	const authorized = { Authorization: `Bearer ${key}` };
	const posts = await request.get('/api/v1/posts', { headers: authorized });

	expect(posts.status()).toBe(200);
	expect(posts.headers()['etag']).toBeDefined();
	expect(posts.headers()['ratelimit-limit']).toBe('120');
	expect(posts.headers()['set-cookie']).toBeUndefined();
	expect(await posts.json()).toMatchObject({ meta: { page: 1, per_page: 20 } });

	const notModified = await request.get('/api/v1/posts', {
		headers: { ...authorized, 'If-None-Match': posts.headers()['etag'] }
	});

	expect(notModified.status()).toBe(304);

	const inQuery = await request.get(`/api/v1/languages?key=${key}`, { headers: authorized });

	expect(inQuery.status()).toBe(400);
	expect(await inQuery.json()).toMatchObject({ error: { code: 'key_in_query' } });
	expect((await request.get('/api/v1/languages')).status()).toBe(401);
	expect((await request.post('/api/v1/posts', { headers: authorized })).status()).toBe(405);
	expect((await request.get('/api/v1/unknown', { headers: authorized })).status()).toBe(404);
	expect(await (await request.get('/api/v1/openapi.json')).json()).toMatchObject({
		openapi: '3.1.0'
	});

	const row = founder.getByTestId('api-key-list').locator('li').filter({ hasText: name });

	await confirmedAction(
		founder,
		async () => {
			await founder.goto('/panel/api-keys');
			await row.getByRole('button', { name: 'Revoke' }).click();

			const dialog = founder.getByRole('dialog');

			await dialog.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
			await dialog.getByRole('button', { name: 'Revoke' }).click();
		},
		'The key was revoked.'
	);

	await expect(row).toContainText('Revoked');
	expect((await request.get('/api/v1/posts', { headers: authorized })).status()).toBe(401);
});

test('the CORS allowlist decides which sites may call the API', async ({ browser, request }) => {
	const founder = await newClient(browser, true);
	const origin = `https://app-${Date.now()}.example.com`;

	await founder.goto('/panel/cors');
	await founder.getByLabel('Origin').fill(`${origin}/`);
	await founder.getByRole('button', { name: 'Add origin' }).click();
	await expect(founder.getByText('The origin was added.')).toBeVisible();
	await expect(founder.getByTestId('cors-origin-list')).toContainText(origin);

	const preflight = await request.fetch('/api/v1/posts', {
		method: 'OPTIONS',
		headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' }
	});

	expect(preflight.status()).toBe(204);
	expect(preflight.headers()['access-control-allow-origin']).toBe(origin);
	expect(preflight.headers()['access-control-allow-credentials']).toBeUndefined();

	const refused = await request.fetch('/api/v1/posts', {
		method: 'OPTIONS',
		headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' }
	});

	expect(refused.status()).toBe(403);
	expect(refused.headers()['access-control-allow-origin']).toBeUndefined();

	const unauthorized = await request.get('/api/v1/languages', { headers: { Origin: origin } });

	expect(unauthorized.status()).toBe(401);
	expect(unauthorized.headers()['access-control-allow-origin']).toBe(origin);

	const panel = await request.get('/panel/login', { headers: { Origin: origin } });

	expect(panel.headers()['access-control-allow-origin']).toBeUndefined();

	await founder
		.getByTestId('cors-origin-list')
		.locator('li')
		.filter({ hasText: origin })
		.getByRole('button', { name: 'Remove' })
		.click();
	await expect(founder.getByText('The origin was removed.')).toBeVisible();

	const removed = await request.fetch('/api/v1/posts', {
		method: 'OPTIONS',
		headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' }
	});

	expect(removed.status()).toBe(403);
});

test('authors cannot manage API keys or CORS origins', async ({ browser }) => {
	const author = await authorPage(browser, 'api-author');

	await expect(author.getByRole('link', { name: 'API keys' })).toHaveCount(0);
	await expect(author.getByRole('link', { name: 'CORS' })).toHaveCount(0);
	expect((await author.goto('/panel/api-keys'))?.status()).toBe(403);
	expect((await author.goto('/panel/cors'))?.status()).toBe(403);
});
