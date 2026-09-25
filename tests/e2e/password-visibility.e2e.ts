import { expect, test } from '@playwright/test';
import { newClient, uniqueEmail } from './support';

const TYPED_PASSWORD = 'not-a-real-account-password';

test('shows the password on request and hides it again when the form is sent', async ({
	browser
}) => {
	const page = await newClient(browser);

	await page.goto('/panel/login');

	const password = page.getByLabel('Password', { exact: true });
	const toggle = page.getByRole('button', { name: 'Show password' });

	await page.getByLabel('Email').fill(uniqueEmail('password-visibility'));
	await password.fill(TYPED_PASSWORD);

	await expect(password).toHaveAttribute('type', 'password');
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');

	await toggle.click();

	await expect(password).toHaveAttribute('type', 'text');
	await expect(password).toHaveValue(TYPED_PASSWORD);
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');

	await toggle.click();

	await expect(password).toHaveAttribute('type', 'password');

	await toggle.click();
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByText('The email address or password is incorrect.')).toBeVisible();
	await expect(password).toHaveAttribute('type', 'password');
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('leaves out the toggle without JavaScript', async ({ browser }) => {
	const page = await newClient(browser, false, false);

	await page.goto('/panel/login');

	await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
	await expect(page.getByRole('button', { name: 'Show password' })).toHaveCount(0);
});
