import type { RequestEvent } from '@sveltejs/kit';
import type { Runtime } from '../runtime.interfaces';
import { isValidSlug } from '../content/slugs';
import { ApiError, apiErrorResponse, notFoundError } from './api-errors';
import { handleApiRequest, languageInScope } from './api-handler';
import { findApiPost, findApiPostBySlug, listApiPosts } from './api-posts';
import { parseQuery, rejectKeyInQuery } from './api-query';
import { listApiAuthors, listApiCategories, listApiLanguages, listApiTags } from './api-resources';
import { apiJson } from './api-response';
import {
	EMPTY_QUERY,
	LIST_QUERY,
	POST_ID_PARAM,
	POST_LIST_QUERY,
	POST_LIST_REPEATABLE,
	POST_QUERY,
	TAG_LIST_QUERY
} from './api-schemas';
import type { ApiRequestContext } from './api.interfaces';
import { openApiDocument } from './openapi';

type ApiEvent = Pick<RequestEvent, 'request' | 'url' | 'locals'>;

function unavailableLanguage(value: string): ApiError {
	return new ApiError(
		400,
		'invalid_query',
		`Invalid value for "lang": the language "${value}" is not available.`
	);
}

function requestedLanguages(
	context: ApiRequestContext,
	values: string[] | undefined
): string[] | null {
	if (values === undefined) {
		return null;
	}

	return values.map((value) => {
		const code = languageInScope(context, value);

		if (code === null) {
			throw unavailableLanguage(value);
		}

		return code;
	});
}

export function postsEndpoint(runtime: Runtime, event: ApiEvent): Response {
	return handleApiRequest(runtime, event, (context, headers) => {
		const query = parseQuery(event.url, POST_LIST_QUERY, POST_LIST_REPEATABLE);
		const result = listApiPosts(context, {
			languages: requestedLanguages(context, query.lang),
			fallback: query.fallback === 'default',
			categoryId: query.category ?? null,
			tagId: query.tag ?? null,
			authorId: query.author ?? null,
			search: query.q ?? null,
			publishedFrom: query.published_from ?? null,
			publishedTo: query.published_to ?? null,
			sort: query.sort,
			order: query.order,
			page: query.page,
			perPage: query.per_page,
			contentFormat: query.content_format
		});

		return apiJson(event.request, result.body, result.lastModified, headers);
	});
}

export function postEndpoint(runtime: Runtime, event: ApiEvent, id: string): Response {
	return handleApiRequest(runtime, event, (context, headers) => {
		const query = parseQuery(event.url, POST_QUERY);
		const postId = POST_ID_PARAM.safeParse(id);

		if (!postId.success) {
			throw notFoundError();
		}

		const result = findApiPost(context, postId.data, query.content_format);

		if (result === null) {
			throw notFoundError();
		}

		return apiJson(event.request, result.body, result.lastModified, headers);
	});
}

export function postBySlugEndpoint(
	runtime: Runtime,
	event: ApiEvent,
	language: string,
	slug: string
): Response {
	return handleApiRequest(runtime, event, (context, headers) => {
		const query = parseQuery(event.url, POST_QUERY);
		const languageCode = languageInScope(context, language);

		if (languageCode === null || !isValidSlug(slug)) {
			throw notFoundError();
		}

		const result = findApiPostBySlug(context, languageCode, slug, query.content_format);

		if (result === null) {
			throw notFoundError();
		}

		return apiJson(event.request, result.body, result.lastModified, headers);
	});
}

export function languagesEndpoint(runtime: Runtime, event: ApiEvent): Response {
	return handleApiRequest(runtime, event, (context, headers) => {
		const query = parseQuery(event.url, LIST_QUERY);
		const result = listApiLanguages(context, query.page, query.per_page);

		return apiJson(event.request, result.body, result.lastModified, headers);
	});
}

export function categoriesEndpoint(runtime: Runtime, event: ApiEvent): Response {
	return handleApiRequest(runtime, event, (context, headers) => {
		const query = parseQuery(event.url, LIST_QUERY);
		const result = listApiCategories(context, query.page, query.per_page);

		return apiJson(event.request, result.body, result.lastModified, headers);
	});
}

export function tagsEndpoint(runtime: Runtime, event: ApiEvent): Response {
	return handleApiRequest(runtime, event, (context, headers) => {
		const query = parseQuery(event.url, TAG_LIST_QUERY);
		const languageCode = languageInScope(context, query.lang);

		if (languageCode === null) {
			throw unavailableLanguage(query.lang);
		}

		const result = listApiTags(context, languageCode, query.page, query.per_page);

		return apiJson(event.request, result.body, result.lastModified, headers);
	});
}

export function authorsEndpoint(runtime: Runtime, event: ApiEvent): Response {
	return handleApiRequest(runtime, event, (context, headers) => {
		const query = parseQuery(event.url, LIST_QUERY);
		const result = listApiAuthors(context, query.page, query.per_page);

		return apiJson(event.request, result.body, result.lastModified, headers);
	});
}

export function openApiEndpoint(runtime: Runtime, event: ApiEvent): Response {
	try {
		rejectKeyInQuery(event.url);
		parseQuery(event.url, EMPTY_QUERY);
	} catch (error) {
		if (error instanceof ApiError) {
			return apiErrorResponse(error);
		}

		throw error;
	}

	return apiJson(event.request, openApiDocument(runtime.env.ORIGIN), null, new Headers());
}
