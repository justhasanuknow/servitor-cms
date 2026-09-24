import { and, sql, type SQL } from 'drizzle-orm';
import { API_SEARCH_MAX_TERMS } from '../../constants/api';
import { postTranslations } from '../db/schema';

const MIN_INDEXED_TERM_LENGTH = 3;

const TERM_SEPARATOR = /\s+/u;

const LIKE_WILDCARDS = /[%_\\]/g;

export function searchTerms(query: string): string[] {
	const terms = query
		.split(TERM_SEPARATOR)
		.map((term) => term.replaceAll('"', '').trim())
		.filter((term) => term !== '');

	return [...new Set(terms)].slice(0, API_SEARCH_MAX_TERMS);
}

export function searchCondition(query: string): SQL {
	const phrases: string[] = [];
	const conditions: SQL[] = [];

	for (const term of searchTerms(query)) {
		if ([...term].length >= MIN_INDEXED_TERM_LENGTH) {
			phrases.push(`"${term}"`);

			continue;
		}

		const fragment = term.replace(LIKE_WILDCARDS, '');

		if (fragment !== '') {
			const pattern = `%${fragment}%`;

			conditions.push(
				sql`${postTranslations.id} in (select translation_id from post_search where title like ${pattern} or excerpt like ${pattern} or content_text like ${pattern})`
			);
		}
	}

	if (phrases.length > 0) {
		conditions.push(
			sql`${postTranslations.id} in (select translation_id from post_search where post_search match ${phrases.join(' AND ')})`
		);
	}

	return and(...conditions) ?? sql`0 = 1`;
}
