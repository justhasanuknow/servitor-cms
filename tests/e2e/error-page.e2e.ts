import { expect, test } from '@playwright/test';

test('unknown routes render the localized not-found page', async ({ page }) => {
	const response = await page.goto('/this-page-does-not-exist');

	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
	await expect(page).toHaveTitle('Page not found');
});
