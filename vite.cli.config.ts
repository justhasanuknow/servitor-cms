import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		ssr: 'src/cli.ts',
		outDir: 'build',
		emptyOutDir: false,
		rolldownOptions: {
			output: {
				entryFileNames: 'cli.js'
			}
		}
	}
});
