import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { E2E_ORIGIN } from '../../playwright.env';
import { authorPage, editorContent, newPost, saveExplicitly } from './posts-support';
import { newClient } from './support';

test('authors write, autosave, save, restore and delete a post', async ({ browser }) => {
	const page = await authorPage(browser, 'posts-author');

	await newPost(page);

	const title = `Autosaved ${Date.now()}`;

	await page.getByPlaceholder('Post title').fill(title);
	await editorContent(page).click();
	await page.keyboard.type('Hello from the editor');

	await expect(page.getByText('Unsaved changes')).toBeVisible();
	await expect(page.getByRole('status').filter({ hasText: /^Saved/ })).toBeVisible({
		timeout: 15_000
	});

	await page.reload();
	await expect(page.getByPlaceholder('Post title')).toHaveValue(title);
	await expect(editorContent(page)).toContainText('Hello from the editor');

	await saveExplicitly(page);
	await expect(page.getByLabel('Slug')).toHaveValue(/^autosaved-[0-9]+$/);

	await editorContent(page).click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type(' and more');
	await saveExplicitly(page);

	await page.getByRole('link', { name: 'Revision history' }).click();

	const revisions = page.getByTestId('revision-list').locator('li');

	await expect(revisions).toHaveCount(2);
	await revisions.nth(1).getByRole('button', { name: 'Restore' }).click();

	await expect(page).toHaveURL(/\/en\?restored$/);
	await expect(page.getByText('The revision was restored into the working draft.')).toBeVisible();
	await expect(editorContent(page)).toContainText('Hello from the editor');
	await expect(editorContent(page)).not.toContainText('and more');

	await page.getByRole('button', { name: 'Delete post' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();

	await expect(page).toHaveURL(/\/panel\/posts$/);
	await expect(page.getByText(title)).toHaveCount(0);
});

test('the editor turns every enabled block into sanitized HTML', async ({ browser }) => {
	const page = await authorPage(browser, 'editor-author');
	const policyViolations: string[] = [];

	page.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) {
			policyViolations.push(message.text());
		}
	});
	await page.route('https://www.youtube-nocookie.com/**', (route) => route.abort());
	await page.goto('/panel/media');
	await page.getByLabel('Image file').setInputFiles({
		name: 'diagram.png',
		mimeType: 'image/png',
		buffer: await sharp({
			create: { width: 320, height: 200, channels: 3, background: '#22aa66' }
		})
			.png()
			.toBuffer()
	});
	await page.getByRole('button', { name: 'Upload', exact: true }).click();
	await expect(page.getByText('The image was uploaded.')).toBeVisible();

	await newPost(page);
	await page.getByPlaceholder('Post title').fill(`Features ${Date.now()}`);
	await editorContent(page).click();
	await page.keyboard.type('Section');
	await page.getByRole('button', { name: 'Heading 2' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.press('ControlOrMeta+b');
	await page.keyboard.type('Bold words');
	await page.keyboard.press('ControlOrMeta+b');

	await page.getByRole('button', { name: 'Video', exact: true }).click();

	const videoDialog = page.getByRole('dialog', { name: 'Embed a video' });

	await videoDialog.getByLabel('Video link').fill('https://evil.example/watch?v=dQw4w9WgXcQ');
	await videoDialog.getByRole('button', { name: 'Insert video' }).click();
	await expect(videoDialog.getByText('This is not a YouTube or Vimeo video link.')).toBeVisible();
	await videoDialog.getByLabel('Video link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
	await videoDialog.getByRole('button', { name: 'Insert video' }).click();
	await expect(videoDialog).toBeHidden();

	await page.getByRole('button', { name: 'Image', exact: true }).click();

	const picker = page.getByRole('dialog', { name: 'Media library' });

	await picker.getByRole('button', { name: 'Insert this image' }).first().click();
	await expect(picker).toBeHidden();

	await page.getByRole('button', { name: 'Math block' }).click();
	await saveExplicitly(page);

	await page.getByRole('link', { name: 'Revision history' }).click();
	await page.getByTestId('revision-list').getByRole('link').first().click();

	const rendered = page.locator('.servitor-content');

	await expect(rendered.locator('h2')).toHaveText('Section');
	await expect(rendered.locator('strong')).toHaveText('Bold words');
	await expect(rendered.locator('iframe')).toHaveAttribute(
		'src',
		'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
	);
	await expect(rendered.locator('iframe')).toHaveAttribute('sandbox', /allow-scripts/);
	await expect(rendered.locator('img')).toHaveAttribute(
		'src',
		/^\/media\/[0-9a-f-]{36}\/1600\.webp$/
	);
	await expect(rendered.locator('[data-type="block-math"] .katex')).toHaveCount(1);
	expect(policyViolations).toEqual([]);
});

test('the server rejects malicious content sent directly to the save action', async ({
	browser
}) => {
	const page = await authorPage(browser, 'direct-author');
	const postId = await newPost(page);
	const maliciousLink = {
		type: 'link',
		attrs: { href: 'javascript:alert(1)', target: null, rel: null, class: null, title: null }
	};
	const response = await page.request.post(`/panel/posts/${postId}/en?/autosave`, {
		headers: { origin: E2E_ORIGIN, 'x-sveltekit-action': 'true' },
		multipart: {
			title: 'Injected',
			slug: '',
			excerpt: '',
			metaTitle: '',
			metaDescription: '',
			ogMediaId: '',
			tags: '',
			version: '0',
			content: JSON.stringify({
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'click', marks: [maliciousLink] }]
					}
				]
			})
		}
	});
	const body = await response.text();

	expect(body).toContain('"type":"failure"');
	expect(body).toContain('invalid_content');

	const crossSite = await page.request.post(`/panel/posts/${postId}/en?/autosave`, {
		headers: { origin: 'https://evil.example', 'x-sveltekit-action': 'true' },
		multipart: { title: 'x', content: '{}', version: '0' }
	});

	expect(crossSite.status()).toBe(403);
});

test('staff can view but not edit or restore an author post', async ({ browser }) => {
	const author = await authorPage(browser, 'viewed-author');
	const postId = await newPost(author);
	const title = `Reviewed ${Date.now()}`;

	await author.getByPlaceholder('Post title').fill(title);
	await saveExplicitly(author);

	const founder = await newClient(browser, true);

	await founder.goto('/panel/posts?scope=all');
	await expect(founder.getByTestId('post-list')).toContainText(title);

	await founder.goto(`/panel/posts/${postId}/en`);
	await expect(founder).toHaveURL(new RegExp(`/panel/posts/${postId}$`));
	await expect(
		founder.getByText('You can view this post and its revisions but you cannot edit it.')
	).toBeVisible();

	await founder.getByRole('link', { name: 'Revision history' }).click();
	await expect(founder.getByTestId('revision-list').locator('li')).toHaveCount(1);
	await expect(founder.getByRole('button', { name: 'Restore' })).toHaveCount(0);

	const stranger = await authorPage(browser, 'stranger-author');
	const forbidden = await stranger.goto(`/panel/posts/${postId}`);

	expect(forbidden?.status()).toBe(403);
});

test('translations get their own tabs, fields and history', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await founder.goto('/panel/languages');

	const list = founder.getByTestId('language-list');

	if (!(await list.textContent())?.includes('Deutsch')) {
		await founder.getByLabel('Language code').fill('de');
		await founder.getByRole('button', { name: 'Add language' }).click();
		await expect(list).toContainText('Deutsch');
	}

	const page = await authorPage(browser, 'translation-author');
	const postId = await newPost(page);

	await page.getByPlaceholder('Post title').fill(`English ${Date.now()}`);
	await saveExplicitly(page);

	await page.getByLabel('Translation language').selectOption('de');
	await page.getByRole('button', { name: 'Add translation' }).click();

	await expect(page).toHaveURL(new RegExp(`/panel/posts/${postId}/de$`));
	await expect(page.getByPlaceholder('Post title')).toHaveValue('');

	await page.getByPlaceholder('Post title').fill('Größe und Maße');
	await saveExplicitly(page);
	await expect(page.getByLabel('Slug')).toHaveValue(/^groesse-und-masse/);

	await page.getByRole('link', { name: /English/ }).click();
	await expect(page).toHaveURL(new RegExp(`/panel/posts/${postId}/en$`));
	await expect(page.getByPlaceholder('Post title')).toHaveValue(/^English /);
});
