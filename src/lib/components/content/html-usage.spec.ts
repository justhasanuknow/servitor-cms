import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = 'src';

const ALLOWED_FILE = ['src', 'lib', 'components', 'content', 'content-html.svelte'].join(sep);

const RAW_HTML_TAG = /\{@html\s/;

function svelteFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return svelteFiles(path);
		}

		if (entry.name.endsWith('.svelte')) {
			return [path];
		}

		return [];
	});
}

describe('raw HTML output', () => {
	it('is only rendered by the content component', () => {
		const offenders = svelteFiles(SOURCE_ROOT)
			.filter((path) => RAW_HTML_TAG.test(readFileSync(path, 'utf8')))
			.map((path) => relative('.', path));

		expect(offenders).toEqual([ALLOWED_FILE]);
	});
});
