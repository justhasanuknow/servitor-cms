import { expect, test } from '@playwright/test';
import {
	acceptInvite,
	confirmedAction,
	createUser,
	E2E_FOUNDER,
	inviteUser,
	newClient,
	signIn,
	uniqueEmail
} from './support';

const PASSWORD = 'e2e-Member-Passphrase-2026';

test('an invited admin sets a password through the one-time link', async ({ browser }) => {
	const founder = await newClient(browser, true);
	const email = uniqueEmail('invited-admin');
	const link = await inviteUser(founder, { name: 'Invited Admin', email, role: 'Admin' });

	await expect(founder.getByTestId('user-table')).toContainText(email);
	await expect(founder.getByTestId('user-table')).toContainText('Invited');

	await acceptInvite(browser, link, PASSWORD);

	const reused = await newClient(browser);

	await reused.goto(link);

	await expect(
		reused.getByText('This link is invalid or has expired. Ask an administrator for a new one.')
	).toBeVisible();

	const admin = await newClient(browser);

	await signIn(admin, email, PASSWORD);

	await expect(admin.getByRole('link', { name: 'Users' })).toBeVisible();
	await expect(admin.getByRole('link', { name: 'Audit log' })).toBeVisible();
});

test('authors cannot open the user list', async ({ browser }) => {
	const email = uniqueEmail('plain-author');

	await createUser(browser, { name: 'Plain Author', email, role: 'Author', password: PASSWORD });

	const author = await newClient(browser);

	await signIn(author, email, PASSWORD);

	await expect(author.getByRole('heading', { name: 'Welcome, Plain Author' })).toBeVisible();
	await expect(author.getByRole('link', { name: 'Users' })).toHaveCount(0);

	const response = await author.goto('/panel/users');

	expect(response?.status()).toBe(403);
	await expect(author.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});

test('deactivating an author ends their sessions and blocks sign-in', async ({ browser }) => {
	const email = uniqueEmail('deactivated-author');

	await createUser(browser, {
		name: 'Soon Deactivated',
		email,
		role: 'Author',
		password: PASSWORD
	});

	const author = await newClient(browser);

	await signIn(author, email, PASSWORD);
	await expect(author).toHaveURL(/\/panel$/);

	const founder = await newClient(browser, true);

	await founder.goto('/panel/users');
	await founder.getByRole('link', { name: 'Soon Deactivated' }).click();

	await expect(founder.getByRole('heading', { name: 'Soon Deactivated' })).toBeVisible();

	await founder.getByRole('button', { name: 'Deactivate' }).click();

	await expect(founder.getByText('The user was deactivated.')).toBeVisible();

	await author.goto('/panel');

	await expect(author).toHaveURL(/\/panel\/login$/);

	await signIn(author, email, PASSWORD);

	await expect(author.getByText('The email address or password is incorrect.')).toBeVisible();

	await founder.getByRole('button', { name: 'Reactivate' }).click();

	await expect(founder.getByText('The user was reactivated.')).toBeVisible();

	await signIn(author, email, PASSWORD);

	await expect(author).toHaveURL(/\/panel$/);
});

test('a password reset link lets the user choose a new password once', async ({ browser }) => {
	const email = uniqueEmail('reset-author');
	const newPassword = 'e2e-Changed-Passphrase-2026';

	await createUser(browser, { name: 'Reset Author', email, role: 'Author', password: PASSWORD });

	const founder = await newClient(browser, true);

	await founder.goto('/panel/users');
	await founder.getByRole('link', { name: 'Reset Author' }).click();

	await expect(founder.getByRole('heading', { name: 'Reset Author' })).toBeVisible();

	await founder.getByRole('button', { name: 'Create reset link' }).click();

	const link = await founder.getByTestId('copy-field').inputValue();
	const user = await newClient(browser);

	await user.goto(link);
	await user.getByLabel('New password', { exact: true }).fill(newPassword);
	await user.getByLabel('Confirm new password').fill(newPassword);
	await user.getByRole('button', { name: 'Save password' }).click();

	await expect(
		user.getByText('Your password has been changed. Sign in with the new password.')
	).toBeVisible();

	await signIn(user, email, PASSWORD);

	await expect(user.getByText('The email address or password is incorrect.')).toBeVisible();

	await signIn(user, email, newPassword);

	await expect(user).toHaveURL(/\/panel$/);
});

test('the founder changes a role after confirming the password', async ({ browser }) => {
	const email = uniqueEmail('promoted-author');

	await createUser(browser, {
		name: 'Promoted Author',
		email,
		role: 'Author',
		password: PASSWORD
	});

	const founder = await newClient(browser, true);

	await founder.goto('/panel/users');
	await founder.getByRole('link', { name: 'Promoted Author' }).click();

	await expect(founder.getByRole('heading', { name: 'Promoted Author' })).toBeVisible();

	const userPage = founder.url();

	await confirmedAction(
		founder,
		async () => {
			await founder.goto(userPage);
			await founder.getByLabel('Role').selectOption({ label: 'Admin' });
			await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
			await founder.getByRole('button', { name: 'Change role' }).click();
		},
		'The role was updated.'
	);
	await expect(founder.locator('dl')).toContainText('Admin');
});
