import { describe, expect, it } from 'vitest';
import { planTransition } from './transitions';
import type { WorkflowChange, WorkflowCommand, WorkflowState } from './transitions.interfaces';

const NOW = new Date('2026-09-24T12:00:00.000Z');

const PAST = new Date('2026-09-24T11:00:00.000Z');

const FUTURE = new Date('2026-09-25T09:00:00.000Z');

const EARLIER = new Date('2026-09-01T08:00:00.000Z');

const DRAFT: WorkflowState = {
	status: 'draft',
	liveRevisionId: null,
	pendingRevisionId: null,
	scheduledAt: null,
	publishedAt: null
};

const PUBLISHED: WorkflowState = {
	status: 'published',
	liveRevisionId: 'live',
	pendingRevisionId: null,
	scheduledAt: null,
	publishedAt: EARLIER
};

function state(overrides: Partial<WorkflowState>): WorkflowState {
	return { ...DRAFT, ...overrides };
}

function change(current: WorkflowState, command: WorkflowCommand): WorkflowChange {
	const outcome = planTransition(current, command, NOW);

	if (outcome.status !== 'ok') {
		throw new Error(`Expected ${command.type} to be allowed`);
	}

	return outcome.change;
}

function publish(scheduledAt: Date | null = null): WorkflowCommand {
	return { type: 'publish', revisionId: 'new', scheduledAt };
}

function submit(scheduledAt: Date | null = null): WorkflowCommand {
	return { type: 'submit', revisionId: 'new', scheduledAt };
}

describe('publish (trusted)', () => {
	it('makes the revision live and sets published_at on the first publish', () => {
		const result = change(DRAFT, publish());

		expect(result.next).toEqual({
			status: 'published',
			liveRevisionId: 'new',
			pendingRevisionId: null,
			scheduledAt: null,
			publishedAt: NOW
		});
		expect(result.event).toBe('post.published');
		expect(result.audit).toBe('post.published');
	});

	it('schedules the first publish when scheduled_at is in the future', () => {
		const result = change(DRAFT, publish(FUTURE));

		expect(result.next).toMatchObject({
			status: 'scheduled',
			liveRevisionId: 'new',
			scheduledAt: FUTURE,
			publishedAt: null
		});
		expect(result.event).toBeNull();
	});

	it('publishes immediately when scheduled_at has passed', () => {
		expect(change(DRAFT, publish(PAST)).next).toMatchObject({
			status: 'published',
			publishedAt: NOW
		});
	});

	it('ignores scheduling after the first publish and keeps published_at', () => {
		const result = change(PUBLISHED, publish(FUTURE));

		expect(result.next).toMatchObject({
			status: 'published',
			liveRevisionId: 'new',
			scheduledAt: null,
			publishedAt: EARLIER
		});
		expect(result.event).toBe('post.updated');
	});

	it('re-publishes an unpublished translation with new content', () => {
		const result = change(state({ ...PUBLISHED, status: 'unpublished' }), publish());

		expect(result.next).toMatchObject({ status: 'published', liveRevisionId: 'new' });
		expect(result.event).toBe('post.published');
	});

	it('replaces a pending submission and withdraws it', () => {
		const result = change(state({ ...PUBLISHED, pendingRevisionId: 'pending' }), publish());

		expect(result.next.pendingRevisionId).toBeNull();
		expect(result.supersededRevisionId).toBe('pending');
	});
});

describe('submit (untrusted)', () => {
	it('sends a never-published translation to review', () => {
		const result = change(DRAFT, submit(FUTURE));

		expect(result.next).toEqual({
			status: 'pending_review',
			liveRevisionId: null,
			pendingRevisionId: 'new',
			scheduledAt: FUTURE,
			publishedAt: null
		});
		expect(result.review).toBe('pending');
		expect(result.reviewedRevisionId).toBe('new');
		expect(result.event).toBeNull();
		expect(result.audit).toBe('post.submitted');
	});

	it('keeps a published translation live and unchanged until approval', () => {
		const result = change(PUBLISHED, submit(FUTURE));

		expect(result.next).toEqual({ ...PUBLISHED, pendingRevisionId: 'new' });
		expect(result.event).toBeNull();
	});

	it('replaces an earlier pending submission', () => {
		const result = change(
			state({ status: 'pending_review', pendingRevisionId: 'older' }),
			submit()
		);

		expect(result.next.pendingRevisionId).toBe('new');
		expect(result.supersededRevisionId).toBe('older');
	});
});

describe('approve', () => {
	it('publishes a first submission like a trusted publish', () => {
		const result = change(state({ status: 'pending_review', pendingRevisionId: 'p' }), {
			type: 'approve'
		});

		expect(result.next).toMatchObject({
			status: 'published',
			liveRevisionId: 'p',
			pendingRevisionId: null,
			publishedAt: NOW
		});
		expect(result.review).toBe('approved');
		expect(result.reviewedRevisionId).toBe('p');
		expect(result.event).toBe('post.published');
		expect(result.audit).toBe('post.approved');
	});

	it('honours a requested schedule that is still in the future', () => {
		const result = change(
			state({ status: 'pending_review', pendingRevisionId: 'p', scheduledAt: FUTURE }),
			{ type: 'approve' }
		);

		expect(result.next).toMatchObject({ status: 'scheduled', scheduledAt: FUTURE });
		expect(result.event).toBeNull();
	});

	it('publishes immediately when the requested schedule has passed', () => {
		const result = change(
			state({ status: 'pending_review', pendingRevisionId: 'p', scheduledAt: PAST }),
			{ type: 'approve' }
		);

		expect(result.next).toMatchObject({ status: 'published', scheduledAt: null });
	});

	it('replaces the live revision of a published translation', () => {
		const result = change(state({ ...PUBLISHED, pendingRevisionId: 'p' }), {
			type: 'approve'
		});

		expect(result.next).toMatchObject({
			status: 'published',
			liveRevisionId: 'p',
			publishedAt: EARLIER
		});
		expect(result.event).toBe('post.updated');
	});

	it('is not allowed without a pending revision', () => {
		expect(planTransition(PUBLISHED, { type: 'approve' }, NOW)).toEqual({
			status: 'not_allowed'
		});
	});
});

describe('reject', () => {
	it('returns a never-published translation to draft', () => {
		const result = change(
			state({ status: 'pending_review', pendingRevisionId: 'p', scheduledAt: FUTURE }),
			{ type: 'reject' }
		);

		expect(result.next).toEqual(DRAFT);
		expect(result.review).toBe('rejected');
		expect(result.reviewedRevisionId).toBe('p');
		expect(result.audit).toBe('post.rejected');
	});

	it('keeps a published translation live with the old revision', () => {
		const result = change(state({ ...PUBLISHED, pendingRevisionId: 'p' }), { type: 'reject' });

		expect(result.next).toEqual(PUBLISHED);
		expect(result.event).toBeNull();
	});

	it('is not allowed without a pending revision', () => {
		expect(planTransition(DRAFT, { type: 'reject' }, NOW).status).toBe('not_allowed');
	});
});

describe('unpublish and re-publish', () => {
	it('unpublishes a published translation and keeps the live revision', () => {
		const result = change(PUBLISHED, { type: 'unpublish' });

		expect(result.next).toEqual({ ...PUBLISHED, status: 'unpublished' });
		expect(result.event).toBe('post.unpublished');
		expect(result.audit).toBe('post.unpublished');
	});

	it('cancels a schedule without announcing an unpublish', () => {
		const result = change(
			state({ status: 'scheduled', liveRevisionId: 'live', scheduledAt: FUTURE }),
			{ type: 'unpublish' }
		);

		expect(result.next).toMatchObject({ status: 'unpublished', scheduledAt: null });
		expect(result.event).toBeNull();
	});

	it.each(['draft', 'pending_review', 'unpublished'] as const)(
		'cannot unpublish a %s translation',
		(status) => {
			expect(
				planTransition(
					state({ status, liveRevisionId: 'live' }),
					{ type: 'unpublish' },
					NOW
				).status
			).toBe('not_allowed');
		}
	);

	it('re-publishes an unchanged live revision without approval', () => {
		const result = change(state({ ...PUBLISHED, status: 'unpublished' }), {
			type: 'republish',
			scheduledAt: FUTURE
		});

		expect(result.next).toEqual(PUBLISHED);
		expect(result.event).toBe('post.published');
	});

	it('schedules a re-publish when the translation was never public', () => {
		const cancelled = state({ status: 'unpublished', liveRevisionId: 'live' });

		expect(change(cancelled, { type: 'republish', scheduledAt: FUTURE })).toMatchObject({
			next: { status: 'scheduled', liveRevisionId: 'live', scheduledAt: FUTURE },
			event: null
		});
		expect(change(cancelled, { type: 'republish', scheduledAt: null })).toMatchObject({
			next: { status: 'published', publishedAt: NOW },
			event: 'post.published'
		});
	});

	it('keeps a waiting submission when re-publishing', () => {
		const result = change(
			state({ ...PUBLISHED, status: 'unpublished', pendingRevisionId: 'p' }),
			{ type: 'republish', scheduledAt: null }
		);

		expect(result.next.pendingRevisionId).toBe('p');
	});

	it.each([DRAFT, PUBLISHED, state({ status: 'pending_review', pendingRevisionId: 'p' })])(
		'cannot re-publish %j',
		(current) => {
			expect(
				planTransition(current, { type: 'republish', scheduledAt: null }, NOW).status
			).toBe('not_allowed');
		}
	);
});

describe('scheduler', () => {
	const scheduled = state({ status: 'scheduled', liveRevisionId: 'live', scheduledAt: PAST });

	it('publishes due translations with their scheduled time', () => {
		const result = change(scheduled, { type: 'run_schedule' });

		expect(result.next).toEqual({
			status: 'published',
			liveRevisionId: 'live',
			pendingRevisionId: null,
			scheduledAt: null,
			publishedAt: PAST
		});
		expect(result.event).toBe('post.published');
	});

	it('leaves translations that are not due or not scheduled alone', () => {
		expect(
			planTransition({ ...scheduled, scheduledAt: FUTURE }, { type: 'run_schedule' }, NOW)
				.status
		).toBe('not_allowed');
		expect(planTransition(PUBLISHED, { type: 'run_schedule' }, NOW).status).toBe('not_allowed');
	});
});
