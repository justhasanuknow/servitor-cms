import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import { E2E_DATA_DIR_VARIABLE, E2E_FOUNDER, E2E_ORIGIN, E2E_PORT } from './playwright.env';

function resolveDataDir(): string {
	const existing = process.env[E2E_DATA_DIR_VARIABLE];

	if (existing) {
		return existing;
	}

	const root = resolve('.tmp', 'e2e');

	rmSync(root, { recursive: true, force: true });
	mkdirSync(root, { recursive: true });

	const created = mkdtempSync(join(root, 'run-'));

	process.env[E2E_DATA_DIR_VARIABLE] = created;

	return created;
}

const dataDir = resolveDataDir();

export default defineConfig({
	testDir: './tests/e2e',
	webServer: {
		command: 'npm run build && node build',
		url: `${E2E_ORIGIN}/healthz`,
		env: {
			HOST: '127.0.0.1',
			PORT: E2E_PORT,
			ORIGIN: E2E_ORIGIN,
			ADDRESS_HEADER: 'x-forwarded-for',
			XFF_DEPTH: '1',
			BETTER_AUTH_SECRET: 'e2e-only-secret-that-is-never-used-outside-tests',
			DATABASE_PATH: join(dataDir, 'servitor.db'),
			UPLOADS_DIR: join(dataDir, 'uploads'),
			BODY_SIZE_LIMIT: '12M',
			FOUNDER_EMAIL: E2E_FOUNDER.email,
			FOUNDER_NAME: E2E_FOUNDER.name,
			FOUNDER_PASSWORD: E2E_FOUNDER.password,
			LOG_LEVEL: 'warn'
		}
	},
	use: {
		baseURL: E2E_ORIGIN
	},
	projects: [
		{
			name: 'setup',
			testMatch: /\.setup\.ts$/
		},
		{
			name: 'e2e',
			testMatch: /\.e2e\.ts$/,
			dependencies: ['setup']
		}
	]
});
