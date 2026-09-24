import { expect, test, type Browser, type Page } from '@playwright/test';
import { E2E_FOUNDER } from '../../../playwright.env';
import { generateTotp } from '../../lib/server/testing/totp';

const ROTATED_PASSWORD = 'e2e-Rotated-Passphrase-2026';

let totpSecret = '';

let backupCodes: string[] = [];

test.describe.configure({ mode: 'serial' });

async function newClient(browser: Browser, address: string): Promise<Page> {
	const context = await browser.newContext({
		extraHTTPHeaders: { 'x-forwarded-for': address }
	});

	return context.newPage();
}

async function signIn(page: Page, password: string): Promise<void> {
	await page.goto('/panel/login');
	await page.getByLabel('Email').fill(E2E_FOUNDER.email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/panel\/login$/);
}

test('sends anonymous visitors to the sign-in page', async ({ browser }) => {
	const page = await newClient(browser, '198.51.100.1');

	await page.goto('/panel/account/sessions');

	await expect(page).toHaveURL(/\/panel\/login$/);
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('rejects a wrong password with a generic message', async ({ browser }) => {
	const page = await newClient(browser, '198.51.100.2');

	await signIn(page, 'not-the-founder-password');

	await expect(page.getByText('The email address or password is incorrect.')).toBeVisible();
	await expect(page).toHaveURL(/\/panel\/login$/);
});

test('forces the founder to replace the seeded password', async ({ browser }) => {
	const page = await newClient(browser, '198.51.100.3');

	await signIn(page, E2E_FOUNDER.password);

	await expect(page).toHaveURL(/\/panel\/account\/password$/);
	await expect(page.getByText('Choose a new password before you continue.')).toBeVisible();

	await page.goto('/panel/account/sessions');

	await expect(page).toHaveURL(/\/panel\/account\/password$/);

	await page.getByLabel('Current password').fill(E2E_FOUNDER.password);
	await page.getByLabel('New password', { exact: true }).fill(ROTATED_PASSWORD);
	await page.getByLabel('Confirm new password').fill(ROTATED_PASSWORD);
	await page.getByRole('button', { name: 'Change password' }).click();

	await expect(
		page.getByText('Your password has been changed and your other sessions were signed out.')
	).toBeVisible();

	await page.getByRole('link', { name: 'Continue to the panel' }).click();

	await expect(page.getByRole('heading', { name: `Welcome, ${E2E_FOUNDER.name}` })).toBeVisible();

	await signOut(page);
	await page.goto('/panel');

	await expect(page).toHaveURL(/\/panel\/login$/);
});

test('enrolls in two-factor authentication and signs in with a code', async ({ browser }) => {
	const page = await newClient(browser, '198.51.100.4');

	await signIn(page, ROTATED_PASSWORD);
	await expect(page).toHaveURL(/\/panel$/);

	await page.goto('/panel/account/two-factor');
	await page.getByLabel('Password').fill(ROTATED_PASSWORD);
	await page.getByRole('button', { name: 'Set up' }).click();

	await expect(
		page.getByRole('img', { name: 'QR code for your authenticator app' })
	).toBeVisible();

	totpSecret = (await page.getByTestId('totp-secret').innerText()).trim();
	backupCodes = await page.getByTestId('backup-codes').locator('li').allInnerTexts();

	expect(backupCodes).toHaveLength(10);

	await page.getByLabel('Authentication code').fill(generateTotp(totpSecret));
	await page.getByRole('button', { name: 'Turn on' }).click();

	await expect(page.getByText('Two-factor authentication is now on.')).toBeVisible();

	await signOut(page);
	await signIn(page, ROTATED_PASSWORD);

	await expect(page).toHaveURL(/\/panel\/login\/two-factor$/);

	await page.getByLabel('Authentication code').fill(generateTotp(totpSecret));
	await page.getByRole('button', { name: 'Verify' }).first().click();

	await expect(page).toHaveURL(/\/panel$/);
});

test('accepts each backup code only once', async ({ browser }) => {
	const page = await newClient(browser, '198.51.100.5');

	await signIn(page, ROTATED_PASSWORD);
	await expect(page).toHaveURL(/\/panel\/login\/two-factor$/);

	await page.getByText('Use a backup code instead').click();
	await page.getByLabel('Backup code').fill(backupCodes[0]);
	await page.getByRole('button', { name: 'Verify' }).last().click();

	await expect(page).toHaveURL(/\/panel$/);

	await signOut(page);
	await signIn(page, ROTATED_PASSWORD);
	await page.getByText('Use a backup code instead').click();
	await page.getByLabel('Backup code').fill(backupCodes[0]);
	await page.getByRole('button', { name: 'Verify' }).last().click();

	await expect(page.getByText('The code is not valid.')).toBeVisible();
});

test('shows active sessions and signs out the others', async ({ browser }) => {
	const first = await newClient(browser, '198.51.100.6');
	const second = await newClient(browser, '198.51.100.7');

	for (const page of [first, second]) {
		await signIn(page, ROTATED_PASSWORD);
		await page.getByLabel('Authentication code').fill(generateTotp(totpSecret));
		await page.getByRole('button', { name: 'Verify' }).first().click();
		await expect(page).toHaveURL(/\/panel$/);
	}

	await first.goto('/panel/account/sessions');

	await expect(first.getByText('This device')).toBeVisible();
	await expect(first.getByTestId('session-list').locator('li').first()).toBeVisible();

	await first.getByRole('button', { name: 'Sign out all other sessions' }).click();

	await expect(first.getByText('All other sessions were signed out.')).toBeVisible();
	await expect(first.getByTestId('session-list').locator('li')).toHaveCount(1);

	await second.goto('/panel');

	await expect(second).toHaveURL(/\/panel\/login$/);
});
