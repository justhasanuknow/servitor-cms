export const MEDIA_KINDS = ['library', 'avatar'] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_SOURCE_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif'] as const;

export type MediaSourceFormat = (typeof MEDIA_SOURCE_FORMATS)[number];

export const MEDIA_VARIANTS = ['480', '960', '1600', 'full'] as const;

export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

export const MEDIA_VARIANT_WIDTHS = {
	'480': 480,
	'960': 960,
	'1600': 1600,
	full: 2560
} as const;

export const MEDIA_CONTENT_VARIANT = '1600';

export const MEDIA_THUMBNAIL_VARIANT = '480';

export const MEDIA_ROUTE_PREFIX = '/media';

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_MEDIA_INPUT_PIXELS = 40_000_000;

export const MAX_MEDIA_ALT_TEXT_LENGTH = 500;

export const MEDIA_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
