import { expect, test } from '@playwright/test';
import { AUTHOR_PASSWORD, authorPage } from './posts-support';
import { newClient, signIn, signOut, uniqueEmail } from './support';

test('without SMTP, an email change applies after confirming the password', async ({ browser }) => {
	const author = await authorPage(browser, 'email-author');
	const address = uniqueEmail('changed-address');

	await author.goto('/panel/account/profile');
	await expect(
		author.getByText('The change applies right away after you confirm it with your password.')
	).toBeVisible();
	await author.getByLabel('New email address').fill(address);
	await author.getByLabel('Password').fill('not-the-right-password');
	await author.getByRole('button', { name: 'Change email address' }).click();
	await expect(author.getByText('The password is incorrect.')).toBeVisible();

	await author.getByLabel('New email address').fill(address);
	await author.getByLabel('Password').fill(AUTHOR_PASSWORD);
	await author.getByRole('button', { name: 'Change email address' }).click();
	await expect(author.getByText(`Your email address is now ${address}.`)).toBeVisible();

	await signOut(author);
	await signIn(author, address, AUTHOR_PASSWORD);
	await expect(author).toHaveURL(/\/panel$/);
});

test('without SMTP, password resets are only offered as links from staff', async ({ browser }) => {
	const visitor = await newClient(browser);

	await visitor.goto('/panel/login');
	await expect(visitor.getByRole('link', { name: 'Forgot your password?' })).toHaveCount(0);
	expect((await visitor.goto('/panel/forgot-password'))?.status()).toBe(404);
});
