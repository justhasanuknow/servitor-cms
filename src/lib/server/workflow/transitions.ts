import type { WebhookEvent } from '../../constants/webhooks';
import type {
	WorkflowChange,
	WorkflowCommand,
	WorkflowOutcome,
	WorkflowState
} from './transitions.interfaces';

export function planTransition(
	state: WorkflowState,
	command: WorkflowCommand,
	now: Date
): WorkflowOutcome {
	switch (command.type) {
		case 'publish':
			return publish(state, command.revisionId, command.scheduledAt, now);
		case 'submit':
			return submit(state, command.revisionId, command.scheduledAt);
		case 'republish':
			return republish(state, command.scheduledAt, now);
		case 'approve':
			return approve(state, now);
		case 'reject':
			return reject(state);
		case 'unpublish':
			return unpublish(state);
		default:
			return runSchedule(state, now);
	}
}

function publish(
	state: WorkflowState,
	revisionId: string,
	scheduledAt: Date | null,
	now: Date
): WorkflowOutcome {
	const live = makeLive(state, revisionId, scheduledAt, now);

	return allowed({
		...live,
		audit: 'post.published',
		review: null,
		reviewedRevisionId: null,
		supersededRevisionId: state.pendingRevisionId
	});
}

function submit(
	state: WorkflowState,
	revisionId: string,
	scheduledAt: Date | null
): WorkflowOutcome {
	const change: Omit<WorkflowChange, 'next'> = {
		event: null,
		audit: 'post.submitted',
		review: 'pending',
		reviewedRevisionId: revisionId,
		supersededRevisionId: state.pendingRevisionId
	};

	if (state.liveRevisionId === null) {
		return allowed({
			...change,
			next: { ...state, status: 'pending_review', pendingRevisionId: revisionId, scheduledAt }
		});
	}

	return allowed({ ...change, next: { ...state, pendingRevisionId: revisionId } });
}

function republish(state: WorkflowState, scheduledAt: Date | null, now: Date): WorkflowOutcome {
	if (state.status !== 'unpublished' || state.liveRevisionId === null) {
		return { status: 'not_allowed' };
	}

	const live = makeLive(state, state.liveRevisionId, scheduledAt, now);

	return allowed({
		next: { ...live.next, pendingRevisionId: state.pendingRevisionId },
		event: live.event,
		audit: 'post.published',
		review: null,
		reviewedRevisionId: null,
		supersededRevisionId: null
	});
}

function approve(state: WorkflowState, now: Date): WorkflowOutcome {
	if (state.pendingRevisionId === null) {
		return { status: 'not_allowed' };
	}

	const live = makeLive(state, state.pendingRevisionId, state.scheduledAt, now);

	return allowed({
		...live,
		audit: 'post.approved',
		review: 'approved',
		reviewedRevisionId: state.pendingRevisionId,
		supersededRevisionId: null
	});
}

function reject(state: WorkflowState): WorkflowOutcome {
	if (state.pendingRevisionId === null) {
		return { status: 'not_allowed' };
	}

	let next: WorkflowState = { ...state, pendingRevisionId: null };

	if (state.liveRevisionId === null) {
		next = { ...next, status: 'draft', scheduledAt: null };
	}

	return allowed({
		next,
		event: null,
		audit: 'post.rejected',
		review: 'rejected',
		reviewedRevisionId: state.pendingRevisionId,
		supersededRevisionId: null
	});
}

function unpublish(state: WorkflowState): WorkflowOutcome {
	if (state.status !== 'published' && state.status !== 'scheduled') {
		return { status: 'not_allowed' };
	}

	let event: WebhookEvent | null = null;

	if (state.status === 'published') {
		event = 'post.unpublished';
	}

	return allowed({
		next: { ...state, status: 'unpublished', scheduledAt: null },
		event,
		audit: 'post.unpublished',
		review: null,
		reviewedRevisionId: null,
		supersededRevisionId: null
	});
}

function runSchedule(state: WorkflowState, now: Date): WorkflowOutcome {
	if (
		state.status !== 'scheduled' ||
		state.scheduledAt === null ||
		state.scheduledAt.getTime() > now.getTime()
	) {
		return { status: 'not_allowed' };
	}

	return allowed({
		next: {
			...state,
			status: 'published',
			scheduledAt: null,
			publishedAt: state.publishedAt ?? state.scheduledAt
		},
		event: 'post.published',
		audit: 'post.published',
		review: null,
		reviewedRevisionId: null,
		supersededRevisionId: null
	});
}

function makeLive(
	state: WorkflowState,
	revisionId: string,
	scheduledAt: Date | null,
	now: Date
): Pick<WorkflowChange, 'next' | 'event'> {
	const firstPublish = state.publishedAt === null;

	if (firstPublish && scheduledAt !== null && scheduledAt.getTime() > now.getTime()) {
		return {
			next: {
				...state,
				status: 'scheduled',
				liveRevisionId: revisionId,
				pendingRevisionId: null,
				scheduledAt
			},
			event: null
		};
	}

	let event: WebhookEvent = 'post.published';

	if (state.status === 'published') {
		event = 'post.updated';
	}

	return {
		next: {
			...state,
			status: 'published',
			liveRevisionId: revisionId,
			pendingRevisionId: null,
			scheduledAt: null,
			publishedAt: state.publishedAt ?? now
		},
		event
	};
}

function allowed(change: WorkflowChange): WorkflowOutcome {
	return { status: 'ok', change };
}
