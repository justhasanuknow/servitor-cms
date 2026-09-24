import type { RevisionReviewState } from '../../constants/content';
import type { PostRecord, TranslationRecord } from './posts.interfaces';

export interface RevisionListItem {
	id: string;
	title: string;
	authorName: string;
	reviewState: RevisionReviewState;
	reviewNote: string | null;
	createdAt: Date;
	isLive: boolean;
	isPending: boolean;
}

export interface RevisionHistory {
	post: PostRecord;
	translation: TranslationRecord;
	revisions: RevisionListItem[];
}

export interface RevisionDetail extends RevisionListItem {
	post: PostRecord;
	translation: TranslationRecord;
	slug: string;
	excerpt: string;
	metaTitle: string | null;
	metaDescription: string | null;
	ogMediaId: string | null;
	contentHtml: string;
	readingTimeMinutes: number;
	tags: string[];
}

export type RevisionRestoreResult = 'restored' | 'not_found' | 'invalid_content' | 'invalid_media';
