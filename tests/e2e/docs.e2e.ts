import { expect, test } from '@playwright/test';
import { newClient } from './support';

test('the panel links to the documentation', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await founder.goto('/panel');
	await founder
		.getByRole('navigation', { name: 'Main navigation' })
		.getByRole('link', { name: 'Documentation' })
		.click();

	await expect(founder).toHaveURL(/\/docs$/);
	await expect(
		founder.getByRole('heading', { level: 1, name: 'Servitor CMS documentation' })
	).toBeVisible();

	await founder.getByRole('link', { name: 'Back to the panel' }).click();
	await expect(founder).toHaveURL(/\/panel$/);

	await founder.getByRole('link', { name: 'Read the documentation' }).click();
	await expect(founder).toHaveURL(/\/docs$/);
});

test('documentation pages are rendered on the server without scripts', async ({ browser }) => {
	const reader = await newClient(browser, true);
	const response = await reader.goto('/docs/installation');
	const headers = response?.headers() ?? {};

	expect(response?.status()).toBe(200);
	expect(headers['cache-control']).toBe('private, no-cache');
	expect(headers['content-security-policy']).not.toContain('nonce-');
	expect(await response?.text()).not.toContain('<script');
	await expect(reader.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
	await expect(reader.locator('html')).toHaveAttribute('lang', 'en');
});

test('documentation pages offer navigation, contents and neighbours', async ({ browser }) => {
	const reader = await newClient(browser, true);

	await reader.goto('/docs/installation');

	await expect(reader.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible();
	await expect(
		reader
			.getByRole('navigation', { name: 'Documentation' })
			.getByRole('link', { name: 'Installation' })
	).toHaveAttribute('aria-current', 'page');
	await expect(
		reader
			.getByRole('navigation', { name: 'On this page' })
			.getByRole('link', { name: 'Requirements' })
	).toHaveAttribute('href', '#requirements');
	await expect(reader.getByRole('heading', { level: 2, name: 'Requirements' })).toHaveAttribute(
		'id',
		'requirements'
	);
	await expect(reader.locator('pre code.language-bash').first()).toBeVisible();

	await reader.locator('a[rel="next"]').click();
	await expect(reader).toHaveURL(/\/docs\/configuration$/);
	await expect(reader.getByRole('heading', { level: 1, name: 'Configuration' })).toBeVisible();

	await reader.locator('a[rel="prev"]').click();
	await expect(reader).toHaveURL(/\/docs\/installation$/);

	await reader
		.getByRole('navigation', { name: 'Documentation' })
		.getByRole('link', { name: 'Webhooks' })
		.click();
	await expect(reader).toHaveURL(/\/docs\/webhooks$/);
	await expect(
		reader.getByRole('article').getByRole('link', { name: 'REST API', exact: true }).first()
	).toHaveAttribute('href', '/docs/api');
});

test('unknown documentation pages are not found', async ({ browser }) => {
	const reader = await newClient(browser, true);

	expect((await reader.goto('/docs/does-not-exist'))?.status()).toBe(404);
	expect((await reader.goto('/docs/readme'))?.status()).toBe(404);
	expect((await reader.goto('/docs/installation.md'))?.status()).toBe(404);
});
