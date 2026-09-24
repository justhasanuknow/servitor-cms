import type { TranslationStatus } from '../../constants/content';
import type { UserRole } from '../../constants/users';

export interface PostRecord {
	id: string;
	ownerId: string;
	ownerRole: UserRole;
	ownerName: string;
	categoryId: string | null;
	coverMediaId: string | null;
	hiddenByModerator: boolean;
	hiddenReason: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface TranslationRecord {
	id: string;
	postId: string;
	languageCode: string;
	status: TranslationStatus;
	slug: string | null;
	workingRevisionId: string | null;
	pendingRevisionId: string | null;
	liveRevisionId: string | null;
	scheduledAt: Date | null;
	publishedAt: Date | null;
	updatedAt: Date;
}

export interface TranslationSummary {
	id: string;
	languageCode: string;
	status: TranslationStatus;
	title: string;
	hasPendingChanges: boolean;
}

export interface PostListItem {
	id: string;
	ownerId: string;
	ownerName: string;
	own: boolean;
	coverMediaId: string | null;
	hiddenByModerator: boolean;
	translations: TranslationSummary[];
	updatedAt: Date;
}

export interface PostListPage {
	items: PostListItem[];
	page: number;
	pageCount: number;
	total: number;
}

export interface PostSettingsInput {
	categoryId: string | null;
	coverMediaId: string | null;
}

export interface TranslationDraftInput {
	title: string;
	slug: string;
	excerpt: string;
	metaTitle: string | null;
	metaDescription: string | null;
	ogMediaId: string | null;
	tags: string;
	content: string;
	version: number;
}

export interface TranslationDraftView {
	title: string;
	slug: string;
	excerpt: string;
	metaTitle: string;
	metaDescription: string;
	ogMediaId: string | null;
	tags: string[];
	content: string;
	readingTimeMinutes: number;
	version: number;
	updatedAt: Date;
}

export interface TranslationEditorView {
	id: string;
	languageCode: string;
	status: TranslationStatus;
	liveSlug: string | null;
	hasPendingChanges: boolean;
	draft: TranslationDraftView;
}

export type PostCreateResult =
	{ status: 'created'; postId: string; languageCode: string } | { status: 'unknown_language' };

export type TranslationAddResult =
	| { status: 'added'; languageCode: string }
	| { status: 'not_found' }
	| { status: 'unknown_language' }
	| { status: 'exists' };

export type PostSettingsResult =
	'saved' | 'not_found' | 'unknown_category' | 'invalid_media' | 'locked';

export type PostDeleteResult = 'deleted' | 'not_found';

export type DraftSaveResult =
	| {
			status: 'saved';
			version: number;
			slug: string;
			readingTimeMinutes: number;
			savedAt: Date;
			snapshotId: string | null;
	  }
	| { status: 'not_found' }
	| { status: 'conflict' }
	| { status: 'invalid_content' }
	| { status: 'content_too_large' }
	| { status: 'invalid_slug' }
	| { status: 'slug_taken' }
	| { status: 'title_required' }
	| { status: 'invalid_media' }
	| { status: 'too_many_tags' }
	| { status: 'tag_too_long' };

export type DraftSaveMode = 'autosave' | 'save';
