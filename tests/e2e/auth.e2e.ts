import { expect, test } from '@playwright/test';
import { generateTotp } from '../../src/lib/server/testing/totp';
import { createUser, E2E_FOUNDER, newClient, signIn, signOut, uniqueEmail } from './support';

const AUTHOR_PASSWORD = 'e2e-Author-Passphrase-2026';

test('sends anonymous visitors to the sign-in page', async ({ browser }) => {
	const page = await newClient(browser);

	await page.goto('/panel/account/sessions');

	await expect(page).toHaveURL(/\/panel\/login$/);
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('rejects a wrong password and an unknown account with the same message', async ({
	browser
}) => {
	const page = await newClient(browser);

	await signIn(page, E2E_FOUNDER.email, 'not-the-founder-password');

	await expect(page.getByText('The email address or password is incorrect.')).toBeVisible();

	await signIn(page, 'nobody@example.com', 'not-the-founder-password');

	await expect(page.getByText('The email address or password is incorrect.')).toBeVisible();
	await expect(page).toHaveURL(/\/panel\/login$/);
});

test.describe('an author account', () => {
	test.describe.configure({ mode: 'serial' });

	const email = uniqueEmail('auth-author');

	let totpSecret = '';

	let backupCodes: string[] = [];

	test.beforeAll(async ({ browser }) => {
		await createUser(browser, {
			name: 'Auth Author',
			email,
			role: 'Author',
			password: AUTHOR_PASSWORD
		});
	});

	test('signs in and out', async ({ browser }) => {
		const page = await newClient(browser);

		await signIn(page, email, AUTHOR_PASSWORD);

		await expect(page.getByRole('heading', { name: 'Welcome, Auth Author' })).toBeVisible();

		await signOut(page);
		await page.goto('/panel');

		await expect(page).toHaveURL(/\/panel\/login$/);
	});

	test('enrolls in two-factor authentication and signs in with a code', async ({ browser }) => {
		const page = await newClient(browser);

		await signIn(page, email, AUTHOR_PASSWORD);
		await expect(page).toHaveURL(/\/panel$/);

		await page.goto('/panel/account/two-factor');
		await page.getByLabel('Password').fill(AUTHOR_PASSWORD);
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
		await signIn(page, email, AUTHOR_PASSWORD);

		await expect(page).toHaveURL(/\/panel\/login\/two-factor$/);

		await page.getByLabel('Authentication code').fill(generateTotp(totpSecret));
		await page.getByRole('button', { name: 'Verify' }).first().click();

		await expect(page).toHaveURL(/\/panel$/);
	});

	test('accepts each backup code only once', async ({ browser }) => {
		const page = await newClient(browser);

		await signIn(page, email, AUTHOR_PASSWORD);
		await expect(page).toHaveURL(/\/panel\/login\/two-factor$/);

		await page.getByText('Use a backup code instead').click();
		await page.getByLabel('Backup code').fill(backupCodes[0]);
		await page.getByRole('button', { name: 'Verify' }).last().click();

		await expect(page).toHaveURL(/\/panel$/);

		await signOut(page);
		await signIn(page, email, AUTHOR_PASSWORD);
		await page.getByText('Use a backup code instead').click();
		await page.getByLabel('Backup code').fill(backupCodes[0]);
		await page.getByRole('button', { name: 'Verify' }).last().click();

		await expect(page.getByText('The code is not valid.')).toBeVisible();
	});

	test('shows active sessions and signs out the others', async ({ browser }) => {
		const first = await newClient(browser);
		const second = await newClient(browser);

		for (const page of [first, second]) {
			await signIn(page, email, AUTHOR_PASSWORD);
			await page.getByLabel('Authentication code').fill(generateTotp(totpSecret));
			await page.getByRole('button', { name: 'Verify' }).first().click();
			await expect(page).toHaveURL(/\/panel$/);
		}

		await first.goto('/panel/account/sessions');

		await expect(first.getByText('This device')).toBeVisible();

		await first.getByRole('button', { name: 'Sign out all other sessions' }).click();

		await expect(first.getByText('All other sessions were signed out.')).toBeVisible();
		await expect(first.getByTestId('session-list').locator('li')).toHaveCount(1);

		await second.goto('/panel');

		await expect(second).toHaveURL(/\/panel\/login$/);
	});
});
