import { expect, test, type Page } from '@playwright/test';
import { E2E_FOUNDER, E2E_ORIGIN } from '../../playwright.env';
import { authorPage, editorContent, newPost } from './posts-support';
import { confirmedAction, newClient } from './support';

test.describe.configure({ mode: 'serial' });

async function publishAsFounder(page: Page, title: string, text: string): Promise<string> {
	await newPost(page);
	await page.getByPlaceholder('Post title').fill(title);
	await page.getByLabel('Excerpt').fill(`Summary of ${title}`);
	await page.getByLabel('Tags').fill('Field work');
	await editorContent(page).click();
	await page.keyboard.type(text);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page).toHaveURL(/\?workflow=published$/);

	return page.getByLabel('Slug').inputValue();
}

test('published posts appear on the public site with SEO metadata and feeds', async ({
	browser
}) => {
	const founder = await newClient(browser, true);
	const title = `Public ${Date.now()}`;
	const slug = await publishAsFounder(founder, title, 'Readable body text');
	const visitor = await newClient(browser);
	const policyViolations: string[] = [];

	visitor.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) {
			policyViolations.push(message.text());
		}
	});

	await visitor.goto('/');
	await expect(visitor).toHaveURL(/\/blog\/en$/);
	await visitor.getByTestId('public-post-list').getByRole('link', { name: title }).click();
	await expect(visitor).toHaveURL(new RegExp(`/blog/en/${slug}$`));
	await expect(visitor.getByRole('heading', { level: 1, name: title })).toBeVisible();
	await expect(visitor.locator('.servitor-content')).toContainText('Readable body text');
	await expect(visitor.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		`${E2E_ORIGIN}/blog/en/${slug}`
	);
	await expect(visitor.locator('link[hreflang="x-default"]')).toHaveAttribute(
		'href',
		`${E2E_ORIGIN}/blog/en/${slug}`
	);
	await expect(visitor.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
	await expect(visitor.locator('meta[name="twitter:card"]')).toHaveAttribute(
		'content',
		'summary'
	);

	const structuredData = JSON.parse(
		(await visitor.locator('script[type="application/ld+json"]').textContent()) ?? '{}'
	);

	expect(structuredData).toMatchObject({ '@type': 'Article', headline: title, inLanguage: 'en' });
	expect(await visitor.locator('script:not([type="application/ld+json"])').count()).toBe(0);

	await visitor.getByRole('link', { name: 'Field work' }).click();
	await expect(visitor).toHaveURL(/\/blog\/en\/tag\/field-work$/);
	await expect(visitor.getByRole('heading', { level: 1, name: 'Tag: Field work' })).toBeVisible();
	await expect(visitor.getByTestId('public-post-list')).toContainText(title);
	expect(policyViolations).toEqual([]);

	const feed = await visitor.request.get('/blog/en/rss.xml');

	expect(feed.headers()['content-type']).toContain('application/rss+xml');
	expect(await feed.text()).toContain(`<link>${E2E_ORIGIN}/blog/en/${slug}</link>`);

	const sitemapIndex = await (await visitor.request.get('/sitemap.xml')).text();

	expect(sitemapIndex).toContain(`<loc>${E2E_ORIGIN}/blog/en/sitemap.xml</loc>`);
	expect(await (await visitor.request.get('/blog/en/sitemap.xml')).text()).toContain(
		`<loc>${E2E_ORIGIN}/blog/en/${slug}</loc>`
	);
	expect(await (await visitor.request.get('/robots.txt')).text()).toContain(
		`Sitemap: ${E2E_ORIGIN}/sitemap.xml`
	);
});

test('drafts stay private and hidden posts disappear from the public site', async ({ browser }) => {
	const author = await authorPage(browser, 'public-author');
	const postId = await newPost(author);
	const stamp = Date.now();
	const title = `Pending ${stamp}`;
	const publicPath = `/blog/en/pending-${stamp}`;

	await author.getByPlaceholder('Post title').fill(title);
	await author.getByRole('button', { name: 'Submit for review' }).click();
	await expect(author).toHaveURL(/\?workflow=submitted$/);

	await author.getByRole('link', { name: 'Preview', exact: true }).click();
	await expect(author).toHaveURL(new RegExp(`/panel/preview/${postId}/en$`));
	await expect(author.getByText('Preview. This version is not public.')).toBeVisible();
	await expect(author.locator('meta[name="robots"]')).toHaveAttribute(
		'content',
		'noindex, nofollow'
	);

	const visitor = await newClient(browser);

	expect((await visitor.goto(publicPath))?.status()).toBe(404);
	await visitor.goto(`/panel/preview/${postId}/en`);
	await expect(visitor).toHaveURL(/\/panel\/login/);

	const founder = await newClient(browser, true);

	await founder.goto(`/panel/reviews/${postId}/en`);
	await founder.getByRole('button', { name: 'Approve and publish' }).click();
	await expect(founder).toHaveURL(/\?decided=approved$/);

	expect((await visitor.goto(publicPath))?.status()).toBe(200);

	await founder.goto(`/panel/posts/${postId}`);
	await founder.getByLabel('Reason').fill('Needs a fact check');
	await founder.getByRole('button', { name: 'Hide post' }).click();
	await expect(founder.getByText('The post is hidden.')).toBeVisible();

	expect((await visitor.goto(publicPath))?.status()).toBe(404);
	expect(await (await visitor.request.get('/blog/en/rss.xml')).text()).not.toContain(title);
});

test('headless mode turns the public routes off', async ({ browser }) => {
	const founder = await newClient(browser, true);
	const visitor = await newClient(browser);

	async function setPublicSite(enabled: boolean): Promise<void> {
		await confirmedAction(
			founder,
			async () => {
				await founder.goto('/panel/settings');
				await founder.getByLabel('Public reading site').setChecked(enabled);
				await founder.getByLabel('Password').fill(E2E_FOUNDER.rotatedPassword);
				await founder.getByRole('button', { name: 'Save settings' }).click();
			},
			'The settings were saved.'
		);
	}

	await setPublicSite(false);

	try {
		expect((await visitor.goto('/blog/en'))?.status()).toBe(404);
		expect((await visitor.request.get('/sitemap.xml')).status()).toBe(404);
		expect((await visitor.request.get('/blog/en/rss.xml')).status()).toBe(404);
		expect(await (await visitor.request.get('/robots.txt')).text()).toContain('Disallow: /\n');

		await visitor.goto('/');
		await expect(visitor).toHaveURL(/\/panel\/login$/);

		expect((await visitor.goto('/docs'))?.status()).toBe(404);
		expect((await visitor.goto('/docs/api'))?.status()).toBe(404);
		expect((await founder.goto('/docs/api'))?.status()).toBe(200);
	} finally {
		await setPublicSite(true);
	}

	expect((await visitor.goto('/blog/en'))?.status()).toBe(200);
	expect((await visitor.goto('/docs/api'))?.status()).toBe(200);
	await visitor.getByRole('link', { name: 'Sign in to the panel' }).click();
	await expect(visitor).toHaveURL(/\/panel\/login$/);
});

test('public pages speak the language of their content', async ({ browser }) => {
	const founder = await newClient(browser, true);

	await founder.goto('/panel/languages');

	const list = founder.getByTestId('language-list');

	if (!(await list.textContent())?.includes('Deutsch')) {
		await founder.getByLabel('Language code').fill('de');
		await founder.getByRole('button', { name: 'Add language' }).click();
		await expect(list).toContainText('Deutsch');
	}

	const visitor = await newClient(browser);

	await visitor.goto('/blog/de');
	await expect(visitor.locator('html')).toHaveAttribute('lang', 'de');
	await expect(visitor.getByRole('navigation', { name: 'Sprachen' })).toBeVisible();
	await expect(visitor.getByRole('link', { name: 'RSS-Feed' })).toBeVisible();
	expect((await visitor.goto('/blog/xx'))?.status()).toBe(404);
});
