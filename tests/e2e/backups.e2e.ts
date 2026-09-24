import { expect, test } from '@playwright/test';
import { E2E_ORIGIN } from '../../playwright.env';
import { createUser, newClient, signIn, uniqueEmail } from './support';

const PASSWORD = 'e2e-Backups-Passphrase-2026';

test('backups need the founder with two-factor authentication', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await founder.goto('/panel');
	await founder
		.getByRole('navigation', { name: 'Main navigation' })
		.getByRole('link', { name: 'Backups' })
		.click();

	await expect(founder).toHaveURL(/\/panel\/backups$/);
	await expect(founder.getByRole('heading', { level: 1, name: 'Backups' })).toBeVisible();
	await expect(founder.getByTestId('backups-two-factor')).toBeVisible();
	await expect(founder.getByRole('button', { name: 'Create backup' })).toHaveCount(0);
	expect((await founder.goto('/panel/backups/not-an-archive'))?.status()).toBe(404);
});

test('authors cannot open or use backups', async ({ browser }) => {
	const email = uniqueEmail('backups-author');

	await createUser(browser, {
		name: 'Backups Author',
		email,
		role: 'Author',
		password: PASSWORD
	});

	const author = await newClient(browser);

	await signIn(author, email, PASSWORD);
	await expect(author).toHaveURL(/\/panel$/);
	await expect(author.getByRole('link', { name: 'Backups' })).toHaveCount(0);
	expect((await author.goto('/panel/backups'))?.status()).toBe(403);
	expect(
		(
			await author.request.post('/panel/backups/uploads', {
				data: { size: 10 },
				headers: { origin: E2E_ORIGIN }
			})
		).status()
	).toBe(403);
	expect((await author.request.get('/panel/backups/status')).status()).toBe(403);
});

test('upload endpoints refuse requests from other sites', async ({ browser }) => {
	const founder = await newClient(browser, true);
	const response = await founder.request.post('/panel/backups/uploads', {
		data: { size: 10 },
		headers: { origin: 'https://attacker.example' }
	});

	expect(response.status()).toBe(403);
});
