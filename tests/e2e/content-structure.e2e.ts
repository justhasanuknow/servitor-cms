import { expect, test } from '@playwright/test';
import { createUser, E2E_FOUNDER, newClient, signIn, uniqueEmail } from './support';

const PASSWORD = 'e2e-Structure-Passphrase-2026';

test('staff manage content languages', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await founder.goto('/panel/languages');

	const list = founder.getByTestId('language-list');

	await expect(list).toContainText('English');
	await expect(list).toContainText('Default');

	await founder.getByLabel('Language code').fill('it');
	await founder.getByRole('button', { name: 'Add language' }).click();

	await expect(founder.getByText('The language it was added.')).toBeVisible();
	await expect(list).toContainText('Italian');

	await founder.getByLabel('Language code').fill('not a language');
	await founder.getByRole('button', { name: 'Add language' }).click();

	await expect(founder.getByText('Enter a valid BCP 47 language code.')).toBeVisible();

	const italian = list.locator('li', { hasText: 'Italian' });

	await italian.getByRole('button', { name: 'Disable' }).click();

	await expect(italian).toContainText('Disabled');

	await italian.locator('summary', { hasText: 'Delete' }).click();
	await italian.getByRole('button', { name: 'Delete' }).click();

	await expect(founder.getByText('The language it was deleted.')).toBeVisible();
	await expect(list).not.toContainText('Italian');
});

test('staff create and edit categories with per-language slugs', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await founder.goto('/panel/languages');
	await founder.getByLabel('Language code').fill('tr');
	await founder.getByRole('button', { name: 'Add language' }).click();
	await expect(founder.getByTestId('language-list')).toContainText('Turkish');

	await founder.goto('/panel/categories');
	await founder.locator('#new-name-en').fill('Travel Notes');
	await founder.locator('#new-name-tr').fill('Gezi Notları');
	await founder.getByRole('button', { name: 'Create category' }).click();

	await expect(founder.getByText('The category was created.')).toBeVisible();

	const categories = founder.getByTestId('category-list');

	await expect(categories).toContainText('/travel-notes');
	await expect(categories).toContainText('/gezi-notlari');

	await founder.getByRole('link', { name: 'Travel Notes' }).click();
	await expect(founder.getByRole('heading', { name: 'Travel Notes', level: 1 })).toBeVisible();

	await founder.locator('#edit-slug-en').fill('travel');
	await founder.getByRole('button', { name: 'Save category' }).click();

	await expect(founder.getByText('The category was saved.')).toBeVisible();

	await founder.getByRole('button', { name: 'Delete category' }).click();

	await expect(founder).toHaveURL(/\/panel\/categories$/);
	await expect(founder.getByText('There are no categories yet.')).toBeVisible();
});

test('authors cannot manage languages, categories or settings', async ({ browser }) => {
	const email = uniqueEmail('structure-author');

	await createUser(browser, {
		name: 'Structure Author',
		email,
		role: 'Author',
		password: PASSWORD
	});

	const author = await newClient(browser);

	await signIn(author, email, PASSWORD);
	await expect(author).toHaveURL(/\/panel$/);
	await expect(author.getByRole('link', { name: 'Languages' })).toHaveCount(0);

	for (const path of ['/panel/languages', '/panel/categories', '/panel/settings']) {
		const response = await author.goto(path);

		expect(response?.status()).toBe(403);
	}
});

test('only the founder changes system settings, after confirming the password', async ({
	browser
}) => {
	const email = uniqueEmail('settings-admin');

	await createUser(browser, { name: 'Settings Admin', email, role: 'Admin', password: PASSWORD });

	const admin = await newClient(browser);

	await signIn(admin, email, PASSWORD);
	await expect(admin.getByRole('link', { name: 'Languages' })).toBeVisible();
	await expect(admin.getByRole('link', { name: 'Settings' })).toHaveCount(0);
	expect((await admin.goto('/panel/settings'))?.status()).toBe(403);

	const founder = await newClient(browser, true);

	await founder.goto('/panel/settings');
	await founder.getByLabel('Site name').fill('Field Notes');
	await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
	await founder.getByRole('button', { name: 'Save settings' }).click();

	await expect(founder.getByText('The settings were saved.')).toBeVisible();
	await expect(founder.getByLabel('Site name')).toHaveValue('Field Notes');

	await founder.goto('/panel/audit?action=settings.updated');

	await expect(founder.getByTestId('audit-entries')).toContainText('settings.updated');
});
