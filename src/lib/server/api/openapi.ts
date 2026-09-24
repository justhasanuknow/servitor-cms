import {
	API_CONTENT_FORMATS,
	API_DEFAULT_PER_PAGE,
	API_FALLBACK_MODES,
	API_MAX_LANGUAGE_FILTERS,
	API_MAX_PAGE,
	API_MAX_PER_PAGE,
	API_PREFIX,
	API_SEARCH_MAX_LENGTH,
	API_SORT_FIELDS,
	API_SORT_ORDERS
} from '../../constants/api';
import { MEDIA_VARIANTS } from '../../constants/media';

const JSON_TYPE = 'application/json';

function ref(kind: 'schemas' | 'parameters' | 'responses' | 'headers', name: string) {
	return { $ref: `#/components/${kind}/${name}` };
}

function jsonContent(schema: Record<string, unknown>) {
	return { [JSON_TYPE]: { schema } };
}

function listOf(item: string) {
	return {
		type: 'object',
		required: ['data', 'meta'],
		properties: {
			data: { type: 'array', items: ref('schemas', item) },
			meta: ref('schemas', 'ListMeta')
		}
	};
}

function itemOf(item: string) {
	return { type: 'object', required: ['data'], properties: { data: ref('schemas', item) } };
}

const successHeaders = {
	ETag: ref('headers', 'ETag'),
	'Last-Modified': ref('headers', 'LastModified'),
	'RateLimit-Limit': ref('headers', 'RateLimitLimit'),
	'RateLimit-Remaining': ref('headers', 'RateLimitRemaining'),
	'RateLimit-Reset': ref('headers', 'RateLimitReset')
};

const errorResponses = {
	'304': ref('responses', 'NotModified'),
	'400': ref('responses', 'BadRequest'),
	'401': ref('responses', 'Unauthorized'),
	'429': ref('responses', 'TooManyRequests')
};

function operation(
	operationId: string,
	summary: string,
	parameters: Record<string, unknown>[],
	schema: Record<string, unknown>,
	notFound: boolean
) {
	const responses: Record<string, unknown> = {
		'200': { description: summary, headers: successHeaders, content: jsonContent(schema) },
		...errorResponses
	};

	if (notFound) {
		responses['404'] = ref('responses', 'NotFound');
	}

	return { get: { operationId, summary, tags: ['Content'], parameters, responses } };
}

function queryParameter(name: string, description: string, schema: Record<string, unknown>) {
	return { name, in: 'query', required: false, description, schema };
}

function pathParameter(name: string, description: string, schema: Record<string, unknown>) {
	return { name, in: 'path', required: true, description, schema };
}

const nullableString = { type: ['string', 'null'] };

const dateTime = { type: 'string', format: 'date-time' };

const schemas = {
	Error: {
		type: 'object',
		required: ['error'],
		properties: {
			error: {
				type: 'object',
				required: ['code', 'message'],
				properties: { code: { type: 'string' }, message: { type: 'string' } }
			}
		}
	},
	ListMeta: {
		type: 'object',
		required: ['page', 'per_page', 'total', 'total_pages'],
		properties: {
			page: { type: 'integer', minimum: 1 },
			per_page: { type: 'integer', minimum: 1, maximum: API_MAX_PER_PAGE },
			total: { type: 'integer', minimum: 0 },
			total_pages: { type: 'integer', minimum: 0 }
		}
	},
	MediaVariant: {
		type: 'object',
		required: ['url', 'width', 'height'],
		properties: {
			url: { type: 'string', format: 'uri' },
			width: { type: 'integer' },
			height: { type: 'integer' }
		}
	},
	Media: {
		type: 'object',
		required: ['id', 'width', 'height', 'alt', 'variants'],
		properties: {
			id: { type: 'string', format: 'uuid' },
			width: { type: 'integer' },
			height: { type: 'integer' },
			alt: {
				type: 'object',
				description: 'Alternative text keyed by language code.',
				additionalProperties: { type: 'string' }
			},
			variants: {
				type: 'object',
				required: [...MEDIA_VARIANTS],
				properties: Object.fromEntries(
					MEDIA_VARIANTS.map((variant) => [variant, ref('schemas', 'MediaVariant')])
				)
			}
		}
	},
	Tag: {
		type: 'object',
		required: ['id', 'name', 'slug'],
		properties: {
			id: { type: 'string', format: 'uuid' },
			name: { type: 'string' },
			slug: { type: 'string' }
		}
	},
	TagSummary: {
		allOf: [
			ref('schemas', 'Tag'),
			{
				type: 'object',
				required: ['language', 'post_count'],
				properties: {
					language: { type: 'string' },
					post_count: { type: 'integer', minimum: 1 }
				}
			}
		]
	},
	CategoryTranslation: {
		type: 'object',
		required: ['language', 'name', 'slug'],
		properties: {
			language: { type: 'string' },
			name: { type: 'string' },
			slug: { type: 'string' }
		}
	},
	Category: {
		type: 'object',
		required: ['id', 'translations'],
		properties: {
			id: { type: 'string', format: 'uuid' },
			translations: { type: 'array', items: ref('schemas', 'CategoryTranslation') }
		}
	},
	Author: {
		type: 'object',
		required: ['id', 'name', 'bio', 'avatar'],
		properties: {
			id: { type: 'string', format: 'uuid' },
			name: { type: 'string' },
			bio: { type: 'string' },
			avatar: { oneOf: [ref('schemas', 'Media'), { type: 'null' }] }
		}
	},
	Language: {
		type: 'object',
		required: ['code', 'name', 'native_name', 'is_default'],
		properties: {
			code: { type: 'string' },
			name: { type: 'string' },
			native_name: { type: 'string' },
			is_default: { type: 'boolean' }
		}
	},
	Translation: {
		type: 'object',
		required: [
			'id',
			'language',
			'slug',
			'url',
			'title',
			'excerpt',
			'meta_title',
			'meta_description',
			'og_image',
			'tags',
			'reading_time_minutes',
			'published_at',
			'updated_at'
		],
		properties: {
			id: { type: 'string', format: 'uuid' },
			language: { type: 'string' },
			slug: { type: 'string' },
			url: {
				type: ['string', 'null'],
				format: 'uri',
				description: 'Address on the public reading site, or null in headless mode.'
			},
			title: { type: 'string' },
			excerpt: { type: 'string' },
			meta_title: nullableString,
			meta_description: nullableString,
			og_image: { oneOf: [ref('schemas', 'Media'), { type: 'null' }] },
			tags: { type: 'array', items: ref('schemas', 'Tag') },
			reading_time_minutes: { type: 'integer', minimum: 0 },
			published_at: { type: ['string', 'null'], format: 'date-time' },
			updated_at: dateTime,
			content_html: {
				type: 'string',
				description: 'Sanitized HTML. Present unless content_format is json.'
			},
			content_json: {
				type: 'object',
				description: 'Editor document. Present when content_format is json or both.'
			}
		}
	},
	Post: {
		type: 'object',
		required: [
			'id',
			'author',
			'category',
			'cover',
			'published_at',
			'updated_at',
			'translations'
		],
		properties: {
			id: { type: 'string', format: 'uuid' },
			author: ref('schemas', 'Author'),
			category: { oneOf: [ref('schemas', 'Category'), { type: 'null' }] },
			cover: { oneOf: [ref('schemas', 'Media'), { type: 'null' }] },
			published_at: { type: ['string', 'null'], format: 'date-time' },
			updated_at: dateTime,
			translations: { type: 'array', items: ref('schemas', 'Translation') }
		}
	}
};

function errorResponse(description: string, extraHeaders: Record<string, unknown> = {}) {
	return {
		description,
		headers: extraHeaders,
		content: jsonContent(ref('schemas', 'Error'))
	};
}

const components = {
	securitySchemes: {
		apiKey: {
			type: 'http',
			scheme: 'bearer',
			description:
				'An API key created in the panel, such as svt_…, sent as a bearer token. Keys in the query string are rejected.'
		}
	},
	parameters: {
		page: queryParameter('page', 'Page number, starting at 1.', {
			type: 'integer',
			minimum: 1,
			maximum: API_MAX_PAGE,
			default: 1
		}),
		per_page: queryParameter('per_page', 'Items per page.', {
			type: 'integer',
			minimum: 1,
			maximum: API_MAX_PER_PAGE,
			default: API_DEFAULT_PER_PAGE
		}),
		content_format: queryParameter(
			'content_format',
			'Which representation of the content to return.',
			{ type: 'string', enum: [...API_CONTENT_FORMATS], default: 'html' }
		)
	},
	headers: {
		ETag: { description: 'Entity tag of the response.', schema: { type: 'string' } },
		LastModified: {
			description: 'When the returned content last changed.',
			schema: { type: 'string' }
		},
		RateLimitLimit: {
			description: 'Requests allowed per minute for this key.',
			schema: { type: 'integer' }
		},
		RateLimitRemaining: {
			description: 'Requests left in the current window.',
			schema: { type: 'integer' }
		},
		RateLimitReset: {
			description: 'Seconds until the current window ends.',
			schema: { type: 'integer' }
		},
		RetryAfter: {
			description: 'Seconds to wait before retrying.',
			schema: { type: 'integer' }
		}
	},
	responses: {
		NotModified: { description: 'The content matches If-None-Match or If-Modified-Since.' },
		BadRequest: errorResponse(
			'Unknown query parameters, invalid values or a key in the query.'
		),
		Unauthorized: errorResponse('The API key is missing, invalid, expired or revoked.', {
			'WWW-Authenticate': { schema: { type: 'string' } }
		}),
		NotFound: errorResponse('The resource does not exist or is outside the key scope.'),
		TooManyRequests: errorResponse('The rate limit of the key was reached.', {
			'Retry-After': ref('headers', 'RetryAfter')
		})
	},
	schemas
};

const pageParameters = [ref('parameters', 'page'), ref('parameters', 'per_page')];

const paths = {
	'/posts': operation(
		'listPosts',
		'List published posts with their translations',
		[
			queryParameter(
				'lang',
				'Only translations in these languages. Repeat the parameter or separate codes with commas.',
				{
					type: 'array',
					items: { type: 'string' },
					maxItems: API_MAX_LANGUAGE_FILTERS
				}
			),
			queryParameter('category', 'Category ID.', { type: 'string', format: 'uuid' }),
			queryParameter('tag', 'Tag ID.', { type: 'string', format: 'uuid' }),
			queryParameter('author', 'Author ID.', { type: 'string', format: 'uuid' }),
			queryParameter('q', 'Full-text search over title, excerpt and content.', {
				type: 'string',
				maxLength: API_SEARCH_MAX_LENGTH
			}),
			queryParameter('published_from', 'Earliest publication date or date-time.', {
				type: 'string'
			}),
			queryParameter('published_to', 'Latest publication date or date-time.', {
				type: 'string'
			}),
			queryParameter('sort', 'Sort field.', {
				type: 'string',
				enum: [...API_SORT_FIELDS],
				default: 'published_at'
			}),
			queryParameter('order', 'Sort direction.', {
				type: 'string',
				enum: [...API_SORT_ORDERS],
				default: 'desc'
			}),
			...pageParameters,
			queryParameter(
				'fallback',
				'With default, posts without a translation in the requested languages return their default-language translation.',
				{ type: 'string', enum: [...API_FALLBACK_MODES], default: 'none' }
			),
			ref('parameters', 'content_format')
		],
		listOf('Post'),
		false
	),
	'/posts/{id}': operation(
		'getPost',
		'Get a post with all its published translations',
		[
			pathParameter('id', 'Post ID.', { type: 'string', format: 'uuid' }),
			ref('parameters', 'content_format')
		],
		itemOf('Post'),
		true
	),
	'/posts/by-slug/{lang}/{slug}': operation(
		'getPostBySlug',
		'Get a post by the slug of one of its translations',
		[
			pathParameter('lang', 'Language code of the translation.', { type: 'string' }),
			pathParameter('slug', 'Slug of the translation.', { type: 'string' }),
			ref('parameters', 'content_format')
		],
		itemOf('Post'),
		true
	),
	'/languages': operation(
		'listLanguages',
		'List enabled content languages',
		pageParameters,
		listOf('Language'),
		false
	),
	'/categories': operation(
		'listCategories',
		'List categories with their names and slugs per language',
		pageParameters,
		listOf('Category'),
		false
	),
	'/tags': operation(
		'listTags',
		'List the tags of a language with their post counts',
		[
			{ ...queryParameter('lang', 'Language code.', { type: 'string' }), required: true },
			...pageParameters
		],
		listOf('TagSummary'),
		false
	),
	'/authors': operation(
		'listAuthors',
		'List the public profiles of authors with published posts',
		pageParameters,
		listOf('Author'),
		false
	),
	'/openapi.json': {
		get: {
			operationId: 'getOpenApiDocument',
			summary: 'This document',
			tags: ['Documentation'],
			security: [],
			parameters: [],
			responses: {
				'200': {
					description: 'The OpenAPI document of this API.',
					content: jsonContent({ type: 'object' })
				}
			}
		}
	}
};

export function openApiDocument(origin: string) {
	return {
		openapi: '3.1.0',
		info: {
			title: 'Servitor CMS API',
			version: '1.0.0',
			description:
				'Read-only access to published content. Every request needs an API key in the Authorization header. Errors use the shape {"error": {"code", "message"}}.'
		},
		servers: [{ url: `${origin}${API_PREFIX}` }],
		security: [{ apiKey: [] }],
		components,
		paths
	};
}
