import { expect, test } from '@playwright/test';
import { E2E_FOUNDER } from '../../playwright.env';
import { editorContent, newPost } from './posts-support';
import { confirmedAction, newClient } from './support';

test('staff add a webhook, follow its deliveries, rotate its secret and delete it', async ({
	browser
}) => {
	const founder = await newClient(browser, true);
	const url = `https://hooks-${Date.now()}.example.com/build`;

	await confirmedAction(
		founder,
		async () => {
			await founder.goto('/panel/webhooks');
			await founder.getByLabel('Endpoint URL').fill(url);
			await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
			await founder.getByRole('button', { name: 'Add webhook' }).click();
		},
		'The webhook was added.'
	);

	const secret = await founder.getByTestId('copy-field').inputValue();

	expect(secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
	await founder.reload();
	await expect(founder.getByTestId('copy-field')).toHaveCount(0);
	await expect(founder.getByTestId('webhook-list')).toContainText(url);

	const author = await newClient(browser, true);

	await newPost(author);
	await author.getByPlaceholder('Post title').fill(`Webhook ${Date.now()}`);
	await editorContent(author).click();
	await author.keyboard.type('Triggers an event');
	await author.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(author).toHaveURL(/\?workflow=published$/);

	await founder.getByRole('link', { name: url }).click();
	await expect(founder).toHaveURL(/\/panel\/webhooks\/[0-9a-f-]{36}$/);

	const deliveries = founder.getByTestId('webhook-deliveries');

	await expect(async () => {
		await founder.reload();
		await expect(deliveries).toContainText('post.published', { timeout: 1_000 });
		await expect(deliveries).toContainText('1 attempts', { timeout: 1_000 });
	}).toPass({ timeout: 30_000 });
	await expect(deliveries).toContainText('The host name could not be resolved.');

	await confirmedAction(
		founder,
		async () => {
			await founder.reload();
			await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
			await founder.getByRole('button', { name: 'Rotate secret' }).click();
		},
		'The secret was rotated.'
	);

	const rotated = await founder.getByTestId('copy-field').inputValue();

	expect(rotated).toMatch(/^whsec_/);
	expect(rotated).not.toBe(secret);

	await founder.getByLabel('Send events to this endpoint').uncheck();
	await founder.getByRole('button', { name: 'Save changes' }).click();
	await expect(founder.getByText('The webhook was saved.')).toBeVisible();
	await expect(founder.getByLabel('Send events to this endpoint')).not.toBeChecked();

	await founder.getByRole('button', { name: 'Delete webhook' }).click();
	await founder.getByRole('dialog').getByRole('button', { name: 'Delete webhook' }).click();
	await expect(founder).toHaveURL(/\/panel\/webhooks$/);
	await expect(founder.getByText(url)).toHaveCount(0);
});

test('webhook addresses must use https', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await confirmedAction(
		founder,
		async () => {
			await founder.goto('/panel/webhooks');
			await founder.getByLabel('Endpoint URL').fill('http://hooks.example.com/build');
			await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
			await founder.getByRole('button', { name: 'Add webhook' }).click();
		},
		'Enter an https address without a user name, password or fragment.'
	);
});
