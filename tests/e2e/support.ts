import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { E2E_DATA_DIR_VARIABLE, E2E_FOUNDER } from '../../playwright.env';
import type { CreatedUser, InvitedUser } from './support.interfaces';

let clientCount = 0;

export function founderStatePath(): string {
	const dataDir = process.env[E2E_DATA_DIR_VARIABLE];

	if (!dataDir) {
		throw new Error(`${E2E_DATA_DIR_VARIABLE} is not set`);
	}

	return join(dataDir, 'founder-state.json');
}

export function uniqueEmail(prefix: string): string {
	return `${prefix}-${process.pid}-${Date.now()}@example.com`;
}

export async function newClient(browser: Browser, founder = false): Promise<Page> {
	clientCount += 1;

	const address = `10.${test.info().workerIndex % 250}.${Math.floor(clientCount / 250)}.${
		(clientCount % 250) + 1
	}`;
	const context = await browser.newContext({
		extraHTTPHeaders: { 'x-forwarded-for': address },
		storageState: founderState(founder)
	});

	return context.newPage();
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
	await page.goto('/panel/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signOut(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
	await expect(page).toHaveURL(/\/panel\/login$/);
}

export async function inviteUser(founder: Page, user: InvitedUser): Promise<string> {
	await founder.goto('/panel/users');
	await founder.getByLabel('Display name').fill(user.name);
	await founder.getByLabel('Email').fill(user.email);
	await founder.getByLabel('Role').selectOption({ label: user.role });
	await founder.getByRole('button', { name: 'Create invitation' }).click();

	const link = founder.getByTestId('copy-field');

	await expect(link).toBeVisible();

	return link.inputValue();
}

export async function acceptInvite(
	browser: Browser,
	link: string,
	password: string
): Promise<void> {
	const page = await newClient(browser);

	await page.goto(link);
	await page.getByLabel('New password', { exact: true }).fill(password);
	await page.getByLabel('Confirm new password').fill(password);
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page.getByText('Your account is ready. You can now sign in.')).toBeVisible();
	await page.context().close();
}

export async function createUser(browser: Browser, user: CreatedUser): Promise<void> {
	const founder = await newClient(browser, true);

	await acceptInvite(browser, await inviteUser(founder, user), user.password);
	await founder.context().close();
}

function founderState(founder: boolean): string | undefined {
	if (!founder) {
		return undefined;
	}

	return founderStatePath();
}

export { E2E_FOUNDER };
