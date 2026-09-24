import type { TranslationStatus } from '../../constants/content';
import type { WebhookEvent } from '../../constants/webhooks';

export interface WorkflowState {
	status: TranslationStatus;
	liveRevisionId: string | null;
	pendingRevisionId: string | null;
	scheduledAt: Date | null;
	publishedAt: Date | null;
}

export type WorkflowCommand =
	| { type: 'publish'; revisionId: string; scheduledAt: Date | null }
	| { type: 'submit'; revisionId: string; scheduledAt: Date | null }
	| { type: 'republish'; scheduledAt: Date | null }
	| { type: 'approve' }
	| { type: 'reject' }
	| { type: 'unpublish' }
	| { type: 'run_schedule' };

export type WorkflowAuditAction =
	'post.published' | 'post.submitted' | 'post.approved' | 'post.rejected' | 'post.unpublished';

export type RevisionReview = 'pending' | 'approved' | 'rejected';

export interface WorkflowChange {
	next: WorkflowState;
	event: WebhookEvent | null;
	audit: WorkflowAuditAction;
	review: RevisionReview | null;
	reviewedRevisionId: string | null;
	supersededRevisionId: string | null;
}

export type WorkflowOutcome = { status: 'ok'; change: WorkflowChange } | { status: 'not_allowed' };
