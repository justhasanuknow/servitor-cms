import { expect, type Browser, type Page } from '@playwright/test';
import { createUser, newClient, signIn, uniqueEmail } from './support';

const PASSWORD = 'e2e-Posts-Passphrase-2026';

const SAVED_TO_HISTORY = 'Saved. A new entry was added to the revision history.';

export async function authorPage(browser: Browser, prefix: string): Promise<Page> {
	const email = uniqueEmail(prefix);

	await createUser(browser, {
		name: `${prefix} writer`,
		email,
		role: 'Author',
		password: PASSWORD
	});

	const page = await newClient(browser);

	await signIn(page, email, PASSWORD);
	await expect(page).toHaveURL(/\/panel$/);

	return page;
}

export async function newPost(page: Page): Promise<string> {
	await page.goto('/panel/posts');
	await page.getByRole('button', { name: 'New post' }).click();
	await expect(page).toHaveURL(/\/panel\/posts\/[0-9a-f-]{36}\/en$/);
	await expect(editorContent(page)).toBeVisible();

	return new URL(page.url()).pathname.split('/')[3];
}

export function editorContent(page: Page) {
	return page.getByRole('textbox', { name: 'Post content' });
}

export async function saveExplicitly(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText(SAVED_TO_HISTORY)).toBeVisible();
}
