import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		ssr: true,
		outDir: 'build',
		emptyOutDir: false,
		rolldownOptions: {
			input: {
				cli: 'src/cli.ts',
				server: 'src/server.ts'
			},
			output: {
				entryFileNames: '[name].js'
			}
		}
	}
});
