import { expect, test, type Page } from '@playwright/test';
import { authorPage, editorContent, newPost } from './posts-support';
import { newClient } from './support';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function localDateTime(date: Date): string {
	const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

	return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function writeDraft(page: Page, title: string, text: string): Promise<void> {
	await page.getByPlaceholder('Post title').fill(title);
	await editorContent(page).click();
	await page.keyboard.type(text);
}

test('authors submit for review, see rejections and publish after approval', async ({
	browser
}) => {
	const author = await authorPage(browser, 'workflow-author');
	const postId = await newPost(author);
	const title = `Submitted ${Date.now()}`;

	await writeDraft(author, title, 'First draft');
	await expect(
		author.getByText('An editor or administrator reviews your changes before they go live.')
	).toBeVisible();
	await author.getByRole('button', { name: 'Submit for review' }).click();

	await expect(author).toHaveURL(/\?workflow=submitted$/);
	await expect(author.getByText(/^Submitted for review\./)).toBeVisible();
	await expect(author.getByText(/^Submitted changes are waiting for review\./)).toBeVisible();

	const founder = await newClient(browser, true);

	await founder.goto('/panel/reviews');
	await founder.getByTestId('review-queue').getByRole('link', { name: title }).click();
	await expect(founder).toHaveURL(new RegExp(`/panel/reviews/${postId}/en$`));
	await expect(founder.locator('.servitor-content')).toContainText('First draft');
	await founder.getByLabel('Note to the author').fill('Please add a source.');
	await founder.getByRole('button', { name: 'Reject' }).click();

	await expect(founder).toHaveURL(/\/panel\/reviews\?decided=rejected$/);
	await expect(
		founder.getByText('The submission was rejected. The author can see your note.')
	).toBeVisible();

	await author.goto(`/panel/posts/${postId}/en`);
	await expect(
		author.getByText('Your last submission was rejected: Please add a source.')
	).toBeVisible();

	await editorContent(author).click();
	await author.keyboard.press('ControlOrMeta+End');
	await author.keyboard.type(' with a source');
	await author.getByRole('button', { name: 'Submit for review' }).click();
	await expect(author).toHaveURL(/\?workflow=submitted$/);
	await expect(author.getByText(/Your last submission was rejected/)).toHaveCount(0);

	await founder.goto(`/panel/reviews/${postId}/en`);
	await expect(founder.locator('.servitor-content')).toContainText('with a source');
	await founder.getByRole('button', { name: 'Approve and publish' }).click();
	await expect(founder).toHaveURL(/\/panel\/reviews\?decided=approved$/);
	await expect(
		founder.getByTestId('review-queue').getByRole('link', { name: title })
	).toHaveCount(0);

	await author.goto(`/panel/posts/${postId}/en`);
	await expect(author.getByText('First published:')).toBeVisible();

	await author.getByRole('button', { name: 'Unpublish' }).click();
	await expect(author).toHaveURL(/\?workflow=unpublished$/);
	await expect(author.getByText('The translation was unpublished.')).toBeVisible();

	await author.getByRole('button', { name: 'Publish again' }).click();
	await expect(author).toHaveURL(/\?workflow=republished$/);
	await expect(author.getByText('The translation is published again.')).toBeVisible();
});

test('trusted users schedule the first publication and can cancel it', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await newPost(founder);
	await writeDraft(founder, `Scheduled ${Date.now()}`, 'Coming soon');

	const publishAt = localDateTime(new Date(Date.now() + WEEK_MS));

	await founder.getByLabel('Publish at (optional)').fill(publishAt);
	await founder.getByRole('button', { name: 'Schedule', exact: true }).click();

	await expect(founder).toHaveURL(/\?workflow=scheduled$/);
	await expect(founder.getByText('The translation is scheduled.')).toBeVisible();
	await expect(founder.getByText('Scheduled for:')).toBeVisible();
	await expect(founder.getByLabel('Publish at (optional)')).toHaveValue(publishAt);

	await founder.getByRole('button', { name: 'Unpublish' }).click();
	await expect(founder).toHaveURL(/\?workflow=unpublished$/);
	await expect(founder.getByText('Scheduled for:')).toHaveCount(0);

	await founder.getByLabel('Publish at (optional)').fill('');
	await founder.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(founder).toHaveURL(/\?workflow=republished$/);
	await expect(founder.getByText('First published:')).toBeVisible();
	await expect(founder.getByLabel('Publish at (optional)')).toHaveCount(0);
});

test('staff hide an author post with a reason the owner can read', async ({ browser }) => {
	const author = await authorPage(browser, 'moderated-author');
	const postId = await newPost(author);

	await writeDraft(author, `Moderated ${Date.now()}`, 'Questionable claims');
	await author.getByRole('button', { name: 'Submit for review' }).click();
	await expect(author).toHaveURL(/\?workflow=submitted$/);

	const founder = await newClient(browser, true);

	await founder.goto(`/panel/posts/${postId}`);
	await founder.getByLabel('Reason').fill('Unverified medical advice');
	await founder.getByRole('button', { name: 'Hide post' }).click();
	await expect(founder.getByText('The post is hidden.')).toBeVisible();
	await expect(
		founder.getByText('Hidden by a moderator: Unverified medical advice')
	).toBeVisible();

	await author.goto(`/panel/posts/${postId}/en`);
	await expect(
		author.getByText('A moderator hid this post: Unverified medical advice')
	).toBeVisible();
	await expect(author.getByRole('button', { name: 'Hide post' })).toHaveCount(0);

	await founder.getByRole('button', { name: 'Unhide post' }).click();
	await expect(founder.getByText('The post is visible again.')).toBeVisible();

	await author.reload();
	await expect(author.getByText(/A moderator hid this post/)).toHaveCount(0);
});
