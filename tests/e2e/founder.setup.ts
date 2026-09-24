import { expect, test as setup } from '@playwright/test';
import { E2E_FOUNDER, founderStatePath, newClient, signIn } from './support';

setup('forces the founder to replace the seeded password', async ({ browser }) => {
	const page = await newClient(browser);

	await signIn(page, E2E_FOUNDER.email, E2E_FOUNDER.password);

	await expect(page).toHaveURL(/\/panel\/account\/password$/);
	await expect(page.getByText('Choose a new password before you continue.')).toBeVisible();

	await page.goto('/panel/users');

	await expect(page).toHaveURL(/\/panel\/account\/password$/);

	await page.getByLabel('Current password').fill(E2E_FOUNDER.password);
	await page.getByLabel('New password', { exact: true }).fill(E2E_FOUNDER.password);
	await page.getByLabel('Confirm new password').fill(E2E_FOUNDER.password);
	await page.getByRole('button', { name: 'Change password' }).click();

	await expect(
		page.getByText('The new password must be different from the current one.')
	).toBeVisible();

	await page.getByLabel('Current password').fill(E2E_FOUNDER.password);
	await page.getByLabel('New password', { exact: true }).fill(E2E_FOUNDER.rotatedPassword);
	await page.getByLabel('Confirm new password').fill(E2E_FOUNDER.rotatedPassword);
	await page.getByRole('button', { name: 'Change password' }).click();

	await expect(
		page.getByText('Your password has been changed and your other sessions were signed out.')
	).toBeVisible();

	await page.getByRole('link', { name: 'Continue to the panel' }).click();

	await expect(page.getByRole('heading', { name: `Welcome, ${E2E_FOUNDER.name}` })).toBeVisible();

	await page.context().storageState({ path: founderStatePath() });
});
