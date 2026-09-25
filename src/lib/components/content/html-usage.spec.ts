import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { svelteFiles } from '$lib/server/testing/source-files';

const SOURCE_ROOT = 'src';

const ALLOWED_FILE = ['src', 'lib', 'components', 'content', 'content-html.svelte'].join(sep);

const RAW_HTML_TAG = /\{@html\s/;

describe('raw HTML output', () => {
	it('is only rendered by the content component', () => {
		const offenders = svelteFiles(SOURCE_ROOT)
			.filter((path) => RAW_HTML_TAG.test(readFileSync(path, 'utf8')))
			.map((path) => relative('.', path));

		expect(offenders).toEqual([ALLOWED_FILE]);
	});
});
