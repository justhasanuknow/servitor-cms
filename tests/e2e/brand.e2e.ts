import { expect, test } from '@playwright/test';

test('pages link the icons and the icon files are served', async ({ request }) => {
	const page = await request.get('/panel/login');
	const html = await page.text();

	expect(html).toMatch(/<link rel="icon" href="[^"]*\/?favicon\.ico" sizes="32x32"/);
	expect(html).toMatch(/<link rel="icon" href="[^"]*\.svg" type="image\/svg\+xml"/);
	expect(html).toMatch(/<link rel="apple-touch-icon" href="[^"]*\/?apple-touch-icon\.png"/);

	for (const [path, type] of [
		['/favicon.ico', /^image\/(x-icon|vnd\.microsoft\.icon)/],
		['/apple-touch-icon.png', /^image\/png/]
	] as const) {
		const response = await request.get(path);

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toMatch(type);
		expect(response.headers()['x-content-type-options']).toBe('nosniff');
	}
});

test('the sign-in page shows the mark next to the product name', async ({ page }) => {
	await page.goto('/panel/login');

	const brand = page.locator('main > p').first();

	await expect(brand).toHaveText('Servitor CMS');
	await expect(brand.locator('svg[aria-hidden="true"]')).toBeVisible();
});
