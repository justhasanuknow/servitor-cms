import { expect, test } from '@playwright/test';
import { newClient, signIn } from './support';

test('the audit log lists security events and filters them', async ({ browser }) => {
	const visitor = await newClient(browser);

	await signIn(visitor, 'audit-probe@example.com', 'not-a-real-password');
	await expect(visitor.getByText('The email address or password is incorrect.')).toBeVisible();

	const founder = await newClient(browser, true);

	await founder.goto('/panel/audit');

	await expect(founder.getByRole('heading', { name: 'Audit log' })).toBeVisible();
	await expect(founder.getByTestId('audit-entries')).toContainText('auth.password_changed');

	await founder.getByLabel('Action').selectOption('auth.login_failed');
	await founder.getByRole('button', { name: 'Filter' }).click();

	await expect(founder).toHaveURL(/action=auth\.login_failed/);

	const entries = founder.getByTestId('audit-entries').locator('li');

	await expect(entries.first()).toContainText('auth.login_failed');
	await expect(founder.getByTestId('audit-entries')).not.toContainText('auth.password_changed');

	await founder.getByLabel('Actor').selectOption({ label: 'Anonymous' });
	await founder.getByRole('button', { name: 'Filter' }).click();

	await expect(founder).toHaveURL(/actor=anonymous/);
	await expect(entries.first()).toContainText('Anonymous');
});
