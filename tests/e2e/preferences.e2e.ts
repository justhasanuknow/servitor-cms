import { expect, test } from '@playwright/test';
import { createUser, newClient, signIn, uniqueEmail } from './support';

const PASSWORD = 'e2e-Profile-Passphrase-2026';

test('the sign-in page follows the browser language until a language is chosen', async ({
	browser
}) => {
	const context = await browser.newContext({
		locale: 'de-DE',
		extraHTTPHeaders: { 'x-forwarded-for': '10.200.0.1' }
	});
	const page = await context.newPage();

	await page.goto('/panel/login');

	await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');

	await page.getByLabel('Sprache').selectOption({ label: 'Türkçe' });
	await page.getByRole('button', { name: 'Ändern' }).click();

	await expect(page.getByRole('heading', { name: 'Giriş yap' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
	await expect(page).toHaveURL(/\/panel\/login$/);

	await context.close();
});

test('public pages use the neutral palette and follow the system mode', async ({ request }) => {
	const html = await (await request.get('/')).text();

	expect(html).toContain('data-palette="neutral"');
	expect(html).toContain('data-mode="system"');
});

test('profile language and theme are rendered by the server on the next load', async ({
	browser
}) => {
	const email = uniqueEmail('profile-author');

	await createUser(browser, {
		name: 'Profile Author',
		email,
		role: 'Author',
		password: PASSWORD
	});

	const page = await newClient(browser);

	await signIn(page, email, PASSWORD);
	await expect(page).toHaveURL(/\/panel$/);

	await page.goto('/panel/account/profile');
	await page.getByLabel('Display name').fill('Profile Author Renamed');
	await page.getByLabel('Bio').fill('Writes about databases.');
	await page.getByLabel('Panel language').selectOption({ label: 'Deutsch' });
	await page.getByText('Blue', { exact: true }).click();
	await page.getByText('Dark', { exact: true }).click();
	await page.getByRole('button', { name: 'Save changes' }).click();

	await expect(page.getByText('Ihr Profil wurde gespeichert.')).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'blue');
	await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
	await expect(page.getByLabel('Anzeigename')).toHaveValue('Profile Author Renamed');

	const html = await (await page.request.get('/panel')).text();

	expect(html).toContain('data-palette="blue"');
	expect(html).toContain('data-mode="dark"');
	expect(html).toContain('lang="de"');

	await page.getByRole('button', { name: 'Abmelden', exact: true }).click();

	await expect(page).toHaveURL(/\/panel\/login$/);
	await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'blue');
});

test('the mobile menu opens as a dialog and closes with Escape', async ({ browser }) => {
	const email = uniqueEmail('mobile-author');

	await createUser(browser, { name: 'Mobile Author', email, role: 'Author', password: PASSWORD });

	const page = await newClient(browser);

	await page.setViewportSize({ width: 390, height: 800 });
	await signIn(page, email, PASSWORD);
	await expect(page).toHaveURL(/\/panel$/);

	await page.getByRole('button', { name: 'Open menu' }).click();

	const menu = page.getByRole('dialog', { name: 'Main navigation' });

	await expect(menu).toBeVisible();
	await expect(menu.getByRole('link', { name: 'My account' })).toBeVisible();
	await expect(menu.getByRole('link', { name: 'Users' })).toHaveCount(0);

	await page.keyboard.press('Escape');

	await expect(menu).toBeHidden();

	await page.getByRole('button', { name: 'Open menu' }).click();
	await menu.getByRole('link', { name: 'My account' }).click();

	await expect(page).toHaveURL(/\/panel\/account\/profile$/);
	await expect(menu).toBeHidden();
});
