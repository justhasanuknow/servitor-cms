import { z } from 'zod';
import {
	API_CONTENT_FORMATS,
	API_DEFAULT_PER_PAGE,
	API_FALLBACK_MODES,
	API_MAX_LANGUAGE_FILTERS,
	API_MAX_PAGE,
	API_MAX_PER_PAGE,
	API_SEARCH_MAX_LENGTH,
	API_SORT_FIELDS,
	API_SORT_ORDERS
} from '../../constants/api';
import { isLanguageTag, MAX_LANGUAGE_TAG_LENGTH } from '../languages/language-tags';

const DATE_ONLY_LENGTH = 10;

const languageTag = z
	.string()
	.max(MAX_LANGUAGE_TAG_LENGTH)
	.refine(isLanguageTag, 'must be a language tag such as en or pt-BR');

const page = z.coerce.number().int().min(1).max(API_MAX_PAGE).default(1);

const perPage = z.coerce.number().int().min(1).max(API_MAX_PER_PAGE).default(API_DEFAULT_PER_PAGE);

const contentFormat = z.enum(API_CONTENT_FORMATS).default('html');

function dateBoundary(time: string) {
	return z.union([z.iso.date(), z.iso.datetime({ offset: true })]).transform((value) => {
		if (value.length === DATE_ONLY_LENGTH) {
			return new Date(`${value}T${time}Z`);
		}

		return new Date(value);
	});
}

export const POST_LIST_QUERY = z.strictObject({
	lang: z.array(languageTag).min(1).max(API_MAX_LANGUAGE_FILTERS).optional(),
	category: z.uuid().optional(),
	tag: z.uuid().optional(),
	author: z.uuid().optional(),
	q: z.string().trim().min(1).max(API_SEARCH_MAX_LENGTH).optional(),
	published_from: dateBoundary('00:00:00.000').optional(),
	published_to: dateBoundary('23:59:59.999').optional(),
	sort: z.enum(API_SORT_FIELDS).default('published_at'),
	order: z.enum(API_SORT_ORDERS).default('desc'),
	page,
	per_page: perPage,
	fallback: z.enum(API_FALLBACK_MODES).default('none'),
	content_format: contentFormat
});

export const POST_LIST_REPEATABLE = ['lang'] as const;

export const POST_QUERY = z.strictObject({ content_format: contentFormat });

export const LIST_QUERY = z.strictObject({ page, per_page: perPage });

export const TAG_LIST_QUERY = z.strictObject({ lang: languageTag, page, per_page: perPage });

export const EMPTY_QUERY = z.strictObject({});

export const POST_ID_PARAM = z.uuid();

export const API_QUERY_SCHEMAS = {
	'/posts': POST_LIST_QUERY,
	'/posts/{id}': POST_QUERY,
	'/posts/by-slug/{lang}/{slug}': POST_QUERY,
	'/languages': LIST_QUERY,
	'/categories': LIST_QUERY,
	'/tags': TAG_LIST_QUERY,
	'/authors': LIST_QUERY,
	'/openapi.json': EMPTY_QUERY
} as const;
