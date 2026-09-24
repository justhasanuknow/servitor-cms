import type { ApiContentFormat, ApiSortField, ApiSortOrder } from '../../constants/api';
import type { MediaVariant } from '../../constants/media';
import type { PublicLanguage } from '../../modules/interfaces/public.interfaces';
import type { DatabaseExecutor } from '../db';
import type { ApiKeyContext } from './api-keys.interfaces';

export interface ApiRequestContext {
	db: DatabaseExecutor;
	origin: string;
	key: ApiKeyContext;
	publicSiteEnabled: boolean;
	defaultLanguage: string | null;
	languages: PublicLanguage[];
}

export interface ApiMediaVariant {
	url: string;
	width: number;
	height: number;
}

export interface ApiMedia {
	id: string;
	width: number;
	height: number;
	alt: Record<string, string>;
	variants: Record<MediaVariant, ApiMediaVariant>;
}

export interface ApiTag {
	id: string;
	name: string;
	slug: string;
}

export interface ApiCategoryTranslation {
	language: string;
	name: string;
	slug: string;
}

export interface ApiCategory {
	id: string;
	translations: ApiCategoryTranslation[];
}

export interface ApiAuthor {
	id: string;
	name: string;
	bio: string;
	avatar: ApiMedia | null;
}

export interface ApiTranslation {
	id: string;
	language: string;
	slug: string;
	url: string | null;
	title: string;
	excerpt: string;
	meta_title: string | null;
	meta_description: string | null;
	og_image: ApiMedia | null;
	tags: ApiTag[];
	reading_time_minutes: number;
	published_at: string | null;
	updated_at: string;
	content_html?: string;
	content_json?: unknown;
}

export interface ApiPost {
	id: string;
	author: ApiAuthor;
	category: ApiCategory | null;
	cover: ApiMedia | null;
	published_at: string | null;
	updated_at: string;
	translations: ApiTranslation[];
}

export interface ApiListMeta {
	page: number;
	per_page: number;
	total: number;
	total_pages: number;
}

export interface ApiList<TItem> {
	data: TItem[];
	meta: ApiListMeta;
}

export interface ApiItem<TItem> {
	data: TItem;
}

export interface ApiResult<TBody> {
	body: TBody;
	lastModified: Date | null;
}

export interface ApiPostFilters {
	languages: string[] | null;
	fallback: boolean;
	categoryId: string | null;
	tagId: string | null;
	authorId: string | null;
	search: string | null;
	publishedFrom: Date | null;
	publishedTo: Date | null;
	sort: ApiSortField;
	order: ApiSortOrder;
	page: number;
	perPage: number;
	contentFormat: ApiContentFormat;
}

export interface ApiLanguage {
	code: string;
	name: string;
	native_name: string;
	is_default: boolean;
}

export interface ApiTagSummary extends ApiTag {
	language: string;
	post_count: number;
}

export interface TranslationCandidate {
	translationId: string;
	postId: string;
	languageCode: string;
	publishedAt: Date | null;
	revisedAt: Date;
}
