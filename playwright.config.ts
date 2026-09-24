import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const dataDir = join(tmpdir(), 'servitor-cms-e2e');

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: {
			ORIGIN: 'http://localhost:4173',
			BETTER_AUTH_SECRET: 'e2e-only-secret-that-is-never-used-outside-tests',
			DATABASE_PATH: join(dataDir, 'servitor.db'),
			UPLOADS_DIR: join(dataDir, 'uploads'),
			LOG_LEVEL: 'warn'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
