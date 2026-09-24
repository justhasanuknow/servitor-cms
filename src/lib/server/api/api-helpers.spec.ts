import { describe, expect, it } from 'vitest';
import { readApiKeyForm } from './api-key-form';
import { ApiError } from './api-errors';
import { parseQuery, queryValues, rejectKeyInQuery } from './api-query';
import { apiJson, latestDate } from './api-response';
import { POST_LIST_QUERY } from './api-schemas';
import { searchTerms } from './api-search';

function url(query: string): URL {
	return new URL(`https://cms.example.com/api/v1/posts${query}`);
}

function thrown(action: () => unknown): ApiError | null {
	try {
		action();
	} catch (error) {
		if (error instanceof ApiError) {
			return error;
		}

		throw error;
	}

	return null;
}

describe('query parsing', () => {
	it('splits repeatable parameters and keeps single values', () => {
		expect(queryValues(url('?lang=en,de&lang=ja&page=2'), ['lang'])).toEqual({
			lang: ['en', 'de', 'ja'],
			page: '2'
		});
	});

	it('applies defaults and converts dates', () => {
		const query = parseQuery(
			url('?published_from=2026-01-01&published_to=2026-01-31'),
			POST_LIST_QUERY,
			['lang']
		);

		expect(query).toMatchObject({
			page: 1,
			per_page: 20,
			sort: 'published_at',
			order: 'desc',
			fallback: 'none',
			content_format: 'html',
			published_from: new Date('2026-01-01T00:00:00.000Z'),
			published_to: new Date('2026-01-31T23:59:59.999Z')
		});
	});

	it('names unknown parameters in the error', () => {
		const error = thrown(() => parseQuery(url('?colour=red&page=1'), POST_LIST_QUERY));

		expect(error).toMatchObject({ status: 400, code: 'invalid_query' });
		expect(error?.message).toBe('Unknown query parameter "colour".');
	});

	it('rejects API keys in the query string', () => {
		for (const query of ['?key=x', '?API_KEY=x', '?access_token=x', '?q=svt_abc']) {
			expect(thrown(() => rejectKeyInQuery(url(query)))).toMatchObject({
				status: 400,
				code: 'key_in_query'
			});
		}

		expect(thrown(() => rejectKeyInQuery(url('?q=keyboard')))).toBeNull();
	});
});

describe('search terms', () => {
	it('splits on whitespace, drops quotes and duplicates and caps the count', () => {
		expect(searchTerms('  "open"  source open ')).toEqual(['open', 'source']);
		expect(
			searchTerms(Array.from({ length: 15 }, (_, index) => `t${index}`).join(' '))
		).toHaveLength(10);
	});
});

describe('JSON responses', () => {
	it('sends validators and answers matching conditional requests with 304', () => {
		const lastModified = new Date('2026-09-01T10:00:00.500Z');
		const first = apiJson(new Request('https://x.test'), { a: 1 }, lastModified, new Headers());
		const etag = first.headers.get('etag') ?? '';

		expect(first.status).toBe(200);
		expect(first.headers.get('last-modified')).toBe('Tue, 01 Sep 2026 10:00:00 GMT');
		expect(first.headers.get('content-type')).toBe('application/json; charset=utf-8');
		expect(
			apiJson(
				new Request('https://x.test', { headers: { 'if-none-match': `W/${etag}` } }),
				{ a: 1 },
				lastModified,
				new Headers()
			).status
		).toBe(304);
		expect(
			apiJson(
				new Request('https://x.test', {
					headers: { 'if-modified-since': 'Tue, 01 Sep 2026 10:00:00 GMT' }
				}),
				{ a: 1 },
				lastModified,
				new Headers()
			).status
		).toBe(304);
		expect(
			apiJson(
				new Request('https://x.test', {
					headers: { 'if-modified-since': 'Tue, 01 Sep 2026 09:59:59 GMT' }
				}),
				{ a: 1 },
				lastModified,
				new Headers()
			).status
		).toBe(200);
	});

	it('finds the latest date', () => {
		expect(latestDate([null, new Date(1), new Date(3), new Date(2)])).toEqual(new Date(3));
		expect(latestDate([null])).toBeNull();
	});
});

describe('API key form', () => {
	function form(entries: [string, string][]): FormData {
		const data = new FormData();

		for (const [name, value] of entries) {
			data.append(name, value);
		}

		return data;
	}

	it('reads scopes, expiry and rate limit', () => {
		const result = readApiKeyForm(
			form([
				['name', ' Website '],
				['languages', 'en'],
				['languages', 'de'],
				['allCategories', 'on'],
				['expiresOn', '2030-05-01'],
				['rateLimit', '30'],
				['password', 'secret'],
				['totpCode', '123 456']
			])
		);

		expect(result).toEqual({
			status: 'ok',
			input: {
				name: 'Website',
				languages: ['en', 'de'],
				categories: null,
				expiresAt: new Date('2030-05-01T23:59:59.999Z'),
				rateLimitPerMinute: 30
			},
			confirmation: { password: 'secret', totpCode: '123456' }
		});
	});

	it('requires a scope when "all" is not selected', () => {
		expect(
			readApiKeyForm(
				form([
					['name', 'Site'],
					['allCategories', 'on'],
					['password', 'secret']
				])
			)
		).toEqual({ status: 'languages_required' });
		expect(
			readApiKeyForm(
				form([
					['name', 'Site'],
					['allLanguages', 'on'],
					['password', 'secret']
				])
			)
		).toEqual({ status: 'categories_required' });
		expect(readApiKeyForm(form([['name', 'Site']]))).toEqual({ status: 'invalid_input' });
	});
});
