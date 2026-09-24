import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { createUser, newClient, signIn, uniqueEmail } from './support';

const PASSWORD = 'e2e-Media-Passphrase-2026';

async function pngImage(width: number, height: number): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
		.png()
		.toBuffer();
}

test('authors upload, describe and delete images in their media library', async ({ browser }) => {
	const email = uniqueEmail('media-author');

	await createUser(browser, { name: 'Media Author', email, role: 'Author', password: PASSWORD });

	const page = await newClient(browser);

	await signIn(page, email, PASSWORD);
	await expect(page).toHaveURL(/\/panel$/);

	await page.goto('/panel/media');
	await expect(page.getByText('You have not uploaded any images yet.')).toBeVisible();

	await page.getByLabel('Image file').setInputFiles({
		name: 'photo.png',
		mimeType: 'image/png',
		buffer: await pngImage(800, 600)
	});
	await page.getByRole('button', { name: 'Upload', exact: true }).click();

	await expect(page.getByText('The image was uploaded.')).toBeVisible();

	const grid = page.getByTestId('media-grid');
	const image = grid.locator('img');

	await expect(image).toHaveCount(1);

	const src = await image.getAttribute('src');

	expect(src).toMatch(/^\/media\/[0-9a-f-]{36}\/480\.webp$/);

	const served = await page.request.get(src ?? '');

	expect(served.status()).toBe(200);
	expect(served.headers()['content-type']).toBe('image/webp');
	expect(served.headers()['x-content-type-options']).toBe('nosniff');
	expect(served.headers()['cache-control']).toContain('immutable');

	await grid.getByRole('button', { name: 'Alt text' }).click();

	const altDialog = page.getByRole('dialog');

	await altDialog.getByLabel('English').fill('A blue square');
	await altDialog.getByRole('button', { name: 'Save alt text' }).click();

	await expect(altDialog).toBeHidden();
	await expect(image).toHaveAttribute('alt', 'A blue square');

	await page.getByLabel('Image file').setInputFiles({
		name: 'disguised.png',
		mimeType: 'image/png',
		buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')
	});
	await page.getByRole('button', { name: 'Upload', exact: true }).click();

	await expect(
		page.getByText('Only JPEG, PNG, WebP, GIF and AVIF images can be uploaded.')
	).toBeVisible();
	await expect(image).toHaveCount(1);

	await grid.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete image' }).click();

	await expect(page.getByText('You have not uploaded any images yet.')).toBeVisible();
	expect((await page.request.get(src ?? '')).status()).toBe(404);
});

test('the media route only serves valid ids and variants', async ({ request }) => {
	const unknown = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

	for (const path of [
		'/media/not-a-uuid/480.webp',
		`/media/${unknown}/480.webp`,
		`/media/${unknown}/999.webp`,
		`/media/${unknown.toUpperCase()}/480.webp`,
		'/media/..%2F..%2Fetc%2Fpasswd/480.webp'
	]) {
		expect((await request.get(path)).status(), path).toBe(404);
	}
});
