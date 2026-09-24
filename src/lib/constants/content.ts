export const TRANSLATION_STATUSES = [
	'draft',
	'pending_review',
	'scheduled',
	'published',
	'unpublished'
] as const;

export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export const REVISION_REVIEW_STATES = ['none', 'pending', 'approved', 'rejected'] as const;

export type RevisionReviewState = (typeof REVISION_REVIEW_STATES)[number];

export const CONTENT_HEADING_LEVELS = [2, 3, 4] as const;

export type ContentHeadingLevel = (typeof CONTENT_HEADING_LEVELS)[number];

export const VIDEO_PROVIDERS = ['youtube', 'vimeo'] as const;

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const ORDERED_LIST_TYPES = ['1', 'a', 'A', 'i', 'I'] as const;

export const MAX_CONTENT_JSON_LENGTH = 1_000_000;

export const MAX_CONTENT_DEPTH = 32;

export const MAX_CONTENT_NODES = 20_000;

export const MAX_CONTENT_CHILDREN = 5_000;

export const MAX_TEXT_NODE_LENGTH = 100_000;

export const MAX_MARKS_PER_NODE = 16;

export const MAX_LATEX_LENGTH = 2_000;

export const MAX_HREF_LENGTH = 2_048;

export const MAX_LINK_ATTRIBUTE_LENGTH = 300;

export const MAX_CODE_LANGUAGE_LENGTH = 32;

export const MAX_TABLE_SPAN = 100;

export const MAX_ORDERED_LIST_START = 1_000_000;

export const WORDS_PER_MINUTE = 200;

export const CJK_CHARACTERS_PER_MINUTE = 500;

export const POST_TITLE_MAX_LENGTH = 200;

export const POST_EXCERPT_MAX_LENGTH = 1_000;

export const META_TITLE_MAX_LENGTH = 200;

export const META_DESCRIPTION_MAX_LENGTH = 500;

export const MAX_TAGS_PER_TRANSLATION = 20;

export const TAG_NAME_MAX_LENGTH = 50;

export const TAG_INPUT_MAX_LENGTH = 1_200;
