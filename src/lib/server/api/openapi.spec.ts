import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_QUERY_SCHEMAS } from './api-schemas';
import { openApiDocument } from './openapi';

const ROUTES_ROOT = join('src', 'routes', 'api', 'v1');

const CATCH_ALL = /^\[\.\.\..+\]$/;

function routePaths(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return routePaths(path);
		}

		if (entry.name !== '+server.ts') {
			return [];
		}

		const segments = relative(ROUTES_ROOT, directory).split(sep).filter(Boolean);

		if (segments.some((segment) => CATCH_ALL.test(segment))) {
			return [];
		}

		return [`/${segments.map((segment) => segment.replace(/^\[(.+)\]$/, '{$1}')).join('/')}`];
	});
}

const document = openApiDocument('https://cms.example.com');

type Parameter = { name: string; in: string; required?: boolean };

function resolveParameter(parameter: unknown): Parameter {
	const value = parameter as { $ref?: string } & Parameter;

	if (value.$ref === undefined) {
		return value;
	}

	const name = value.$ref.split('/').at(-1) ?? '';
	const parameters = document.components.parameters as Record<string, Parameter>;

	return parameters[name];
}

describe('OpenAPI document', () => {
	it('documents exactly the implemented routes', () => {
		expect(Object.keys(document.paths).sort()).toEqual(routePaths(ROUTES_ROOT).sort());
		expect(Object.keys(API_QUERY_SCHEMAS).sort()).toEqual(Object.keys(document.paths).sort());
	});

	it('documents exactly the query parameters each route accepts', () => {
		for (const [path, schema] of Object.entries(API_QUERY_SCHEMAS)) {
			const operation = document.paths[path as keyof typeof document.paths].get;
			const documented = operation.parameters
				.map(resolveParameter)
				.filter((parameter) => parameter.in === 'query')
				.map((parameter) => parameter.name)
				.sort();

			expect(documented, path).toEqual(Object.keys(schema.shape).sort());
		}
	});

	it('documents every path parameter of a route', () => {
		for (const path of Object.keys(document.paths)) {
			const operation = document.paths[path as keyof typeof document.paths].get;
			const documented = operation.parameters
				.map(resolveParameter)
				.filter((parameter) => parameter.in === 'path')
				.map((parameter) => parameter.name)
				.sort();
			const expected = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();

			expect(documented, path).toEqual(expected);
		}
	});

	it('resolves every reference', () => {
		const references = [...JSON.stringify(document).matchAll(/"\$ref":"#\/([^"]+)"/g)].map(
			(match) => match[1]
		);

		for (const reference of references) {
			const target = reference
				.split('/')
				.reduce<unknown>(
					(node, key) => (node as Record<string, unknown> | undefined)?.[key],
					document
				);

			expect(target, reference).toBeDefined();
		}
	});
});
