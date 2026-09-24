export const TRANSLATION_STATUSES = [
	'draft',
	'pending_review',
	'scheduled',
	'published',
	'unpublished'
] as const;

export const REVISION_REVIEW_STATES = ['none', 'pending', 'approved', 'rejected'] as const;
