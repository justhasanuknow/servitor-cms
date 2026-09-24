import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { E2E_FOUNDER } from '../../playwright.env';
import { newClient, unusedTotp } from './support';

test.describe.configure({ mode: 'serial', timeout: 300_000 });

const PASSPHRASE = 'e2e backup passphrase 2026';

const ENCRYPTED_MAGIC = 'SERVITOR-BACKUP-ENCRYPTED-1';

function formWith(page: Page, button: string): Locator {
	return page.locator('form', { has: page.getByRole('button', { name: button }) });
}

async function confirm(form: Locator, secret: string): Promise<void> {
	await form.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
	await form.getByLabel('Authentication code').fill(await unusedTotp(secret));
}

test('the founder creates, downloads, uploads, deletes and schedules backups', async ({
	browser
}, testInfo) => {
	const founder = await newClient(browser, true);

	await founder.goto('/panel/account/two-factor');
	await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
	await founder.getByRole('button', { name: 'Set up' }).click();

	const secret = (await founder.getByTestId('totp-secret').innerText()).trim();

	await founder.getByLabel('Authentication code').fill(await unusedTotp(secret));
	await founder.getByRole('button', { name: 'Turn on' }).click();
	await expect(founder.getByText('Two-factor authentication is now on.')).toBeVisible();

	await founder.goto('/panel/backups');
	await founder.getByRole('button', { name: 'Create backup' }).click();

	const rows = founder.getByTestId('backup-list').locator('tbody tr');

	await expect(rows).toHaveCount(1, { timeout: 60_000 });
	await expect(founder.getByTestId('backup-job')).toContainText('was created successfully');

	await rows.first().getByRole('link', { name: 'Manage' }).click();
	await expect(founder).toHaveURL(/\/panel\/backups\/servitor-backup-[^/]+\.tar\.gz$/);

	const download = formWith(founder, 'Download backup');

	await download.getByLabel('Passphrase (optional)').fill(PASSPHRASE);
	await download.getByLabel('Repeat the passphrase').fill(PASSPHRASE);
	await confirm(download, secret);

	const started = founder.waitForEvent('download');

	await download.getByRole('button', { name: 'Download backup' }).click();

	const file = await started;
	const saved = testInfo.outputPath(file.suggestedFilename());

	expect(file.suggestedFilename()).toMatch(/^servitor-backup-.+\.tar\.gz\.enc$/);
	await file.saveAs(saved);
	expect(readFileSync(saved).subarray(0, ENCRYPTED_MAGIC.length).toString('ascii')).toBe(
		ENCRYPTED_MAGIC
	);

	await founder.goto('/panel/backups');
	await founder.getByLabel('Backup file').setInputFiles(saved);
	await founder.getByLabel('Passphrase, if the archive is encrypted').fill(PASSPHRASE);
	await founder.getByRole('button', { name: 'Upload', exact: true }).click();
	await expect(founder.getByText(/The archive was uploaded as servitor-upload-/)).toBeVisible({
		timeout: 60_000
	});
	await expect(rows).toHaveCount(2);

	await rows.filter({ hasText: 'Uploaded' }).getByRole('link', { name: 'Manage' }).click();
	await expect(founder).toHaveURL(/\/panel\/backups\/servitor-upload-[^/]+\.tar\.gz$/);

	const restore = formWith(founder, 'Restore this backup');

	await restore.getByLabel('Type RESTORE to confirm').fill('restore please');
	await restore.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
	await restore.getByLabel('Authentication code').fill('000000');
	await restore.getByRole('button', { name: 'Restore this backup' }).click();
	await expect(founder.getByText('Type the confirmation word exactly as shown.')).toBeVisible();

	const remove = formWith(founder, 'Delete backup');

	await confirm(remove, secret);
	await remove.getByRole('button', { name: 'Delete backup' }).click();
	await expect(founder).toHaveURL(/\/panel\/backups\?deleted=1$/);
	await expect(founder.getByText('The backup was deleted.')).toBeVisible();
	await expect(rows).toHaveCount(1);

	const schedule = formWith(founder, 'Save schedule');

	await schedule.getByLabel('Frequency').selectOption('daily');
	await schedule.getByLabel('Hour (UTC)').fill('5');
	await schedule.getByLabel('Scheduled backups to keep').fill('3');
	await confirm(schedule, secret);
	await schedule.getByRole('button', { name: 'Save schedule' }).click();
	await expect(founder.getByText('The schedule was saved.')).toBeVisible();
	await expect(founder.getByTestId('backup-next')).toContainText('Next scheduled backup:');
});
