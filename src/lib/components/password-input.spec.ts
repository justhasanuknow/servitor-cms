import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { svelteFiles } from '$lib/server/testing/source-files';

const SOURCE_ROOT = 'src';

const PLAIN_PASSWORD_FIELD = /type=["']password["']/;

describe('password fields', () => {
	it('all use the password input, which can show the value', () => {
		const offenders = svelteFiles(SOURCE_ROOT)
			.filter((path) => PLAIN_PASSWORD_FIELD.test(readFileSync(path, 'utf8')))
			.map((path) => relative('.', path));

		expect(offenders).toEqual([]);
	});
});
