import type { z } from 'zod';
import { API_KEY_PREFIX, API_QUERY_KEY_NAMES } from '../../constants/api';
import { ApiError } from './api-errors';

const KEY_NAMES: readonly string[] = API_QUERY_KEY_NAMES;

export function rejectKeyInQuery(url: URL): void {
	for (const [name, value] of url.searchParams) {
		if (KEY_NAMES.includes(name.toLowerCase()) || value.trim().startsWith(API_KEY_PREFIX)) {
			throw new ApiError(
				400,
				'key_in_query',
				'API keys must be sent in the Authorization header, never in the query string.'
			);
		}
	}
}

export function queryValues(
	url: URL,
	repeatable: readonly string[]
): Record<string, string | string[]> {
	const values: Record<string, string | string[]> = {};

	for (const name of new Set(url.searchParams.keys())) {
		const entries = url.searchParams.getAll(name);

		if (repeatable.includes(name)) {
			values[name] = entries
				.flatMap((entry) => entry.split(','))
				.map((entry) => entry.trim())
				.filter((entry) => entry !== '');

			continue;
		}

		if (entries.length > 1) {
			throw new ApiError(
				400,
				'invalid_query',
				`The query parameter "${name}" may only appear once.`
			);
		}

		values[name] = entries[0];
	}

	return values;
}

export function parseQuery<TSchema extends z.ZodType>(
	url: URL,
	schema: TSchema,
	repeatable: readonly string[] = []
): z.output<TSchema> {
	const parsed = schema.safeParse(queryValues(url, repeatable));

	if (!parsed.success) {
		throw new ApiError(400, 'invalid_query', describeIssues(parsed.error.issues));
	}

	return parsed.data;
}

function describeIssues(issues: z.core.$ZodIssue[]): string {
	return issues
		.map((issue) => {
			if (issue.code === 'unrecognized_keys') {
				return issue.keys.map((key) => `Unknown query parameter "${key}".`).join(' ');
			}

			return `Invalid value for "${issue.path.map(String).join('.')}": ${issue.message}.`;
		})
		.join(' ');
}
