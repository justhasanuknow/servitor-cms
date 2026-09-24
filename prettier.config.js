/** @type {import("prettier").Config} */
const config = {
	useTabs: true,
	tabWidth: 4,
	singleQuote: true,
	trailingComma: 'none',
	printWidth: 100,
	plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
	overrides: [
		{ files: '*.svelte', options: { parser: 'svelte' } },
		{ files: ['*.md', '*.yml', '*.yaml'], options: { useTabs: false, tabWidth: 2 } }
	],
	tailwindStylesheet: './src/routes/layout.css'
};

export default config;
