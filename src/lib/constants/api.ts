export const API_PREFIX = '/api/v1';

export const API_KEY_PREFIX = 'svt_';

export const API_KEY_BYTES = 32;

export const API_KEY_VISIBLE_CHARACTERS = 8;

export const API_KEY_MAX_LENGTH = 128;

export const API_KEY_NAME_MAX_LENGTH = 100;

export const API_KEY_LAST_USED_RESOLUTION_MS = 60_000;

export const API_RATE_LIMIT_WINDOW_MS = 60_000;

export const API_DEFAULT_PER_PAGE = 20;

export const API_MAX_PER_PAGE = 100;

export const API_MAX_PAGE = 100_000;

export const API_SEARCH_MAX_LENGTH = 200;

export const API_SEARCH_MAX_TERMS = 10;

export const API_MAX_LANGUAGE_FILTERS = 20;

export const API_CONTENT_FORMATS = ['html', 'json', 'both'] as const;

export type ApiContentFormat = (typeof API_CONTENT_FORMATS)[number];

export const API_SORT_FIELDS = ['published_at', 'updated_at'] as const;

export type ApiSortField = (typeof API_SORT_FIELDS)[number];

export const API_SORT_ORDERS = ['asc', 'desc'] as const;

export type ApiSortOrder = (typeof API_SORT_ORDERS)[number];

export const API_FALLBACK_MODES = ['none', 'default'] as const;

export const API_QUERY_KEY_NAMES = ['key', 'api_key', 'apikey', 'access_token', 'token'] as const;

export const CORS_ORIGIN_MAX_LENGTH = 300;

export const MAX_CORS_ORIGINS = 100;

export const CORS_MAX_AGE_SECONDS = 600;
