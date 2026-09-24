import type { AuditActorType } from '../../constants/audit';
import type { TranslationStatus } from '../../constants/content';
import type { DraftSaveResult } from '../posts/posts.interfaces';
import type { WorkflowChange } from './transitions.interfaces';

export interface WorkflowActor {
	type: AuditActorType;
	id: string | null;
	ip: string | null;
	userAgent: string | null;
}

export type WorkflowApplyResult =
	| { status: 'ok'; change: WorkflowChange }
	| { status: 'not_found' }
	| { status: 'not_allowed' }
	| { status: 'slug_taken' };

export type PublishOutcome = 'published' | 'scheduled' | 'submitted' | 'republished';

export type PublishResult =
	| Exclude<DraftSaveResult, { status: 'saved' }>
	| { status: 'done'; outcome: PublishOutcome }
	| { status: 'not_allowed' }
	| { status: 'slug_taken' }
	| { status: 'invalid_schedule' };

export type ReviewDecision = 'approve' | 'reject';

export type ReviewResult =
	| 'approved'
	| 'rejected'
	| 'not_found'
	| 'stale'
	| 'note_required'
	| 'slug_taken'
	| 'not_allowed';

export type UnpublishResult = 'unpublished' | 'not_found' | 'not_allowed';

export type ModerationResult =
	'hidden' | 'unhidden' | 'not_found' | 'already_hidden' | 'not_hidden' | 'reason_required';

export interface WorkflowRejection {
	note: string;
	reviewedAt: Date;
}

export interface TranslationWorkflowView {
	status: TranslationStatus;
	trusted: boolean;
	scheduledAt: Date | null;
	publishedAt: Date | null;
	pending: boolean;
	live: boolean;
	unchangedSinceLive: boolean;
	rejection: WorkflowRejection | null;
}

export interface ReviewQueueItem {
	postId: string;
	languageCode: string;
	revisionId: string;
	title: string;
	ownerName: string;
	submittedAt: Date;
	update: boolean;
	scheduledAt: Date | null;
}

export interface ReviewRevisionView {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	metaTitle: string | null;
	metaDescription: string | null;
	ogMediaId: string | null;
	contentHtml: string;
	readingTimeMinutes: number;
	tags: string[];
	createdAt: Date;
}

export interface ReviewView {
	postId: string;
	languageCode: string;
	ownerName: string;
	status: TranslationStatus;
	scheduledAt: Date | null;
	pending: ReviewRevisionView;
	live: ReviewRevisionView | null;
}
