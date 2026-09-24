import type { PublishOutcome, SavedDraft, WorkflowNotice } from './translation-editor.interfaces';

const PUBLISH_OUTCOMES: readonly PublishOutcome[] = [
	'published',
	'scheduled',
	'submitted',
	'republished'
];

function isPublishOutcome(value: unknown): value is PublishOutcome {
	return PUBLISH_OUTCOMES.some((outcome) => outcome === value);
}

export function publishOutcomeOf(data: unknown): PublishOutcome | null {
	if (typeof data !== 'object' || data === null || !('published' in data)) {
		return null;
	}

	const published = data.published;

	if (typeof published !== 'object' || published === null || !('outcome' in published)) {
		return null;
	}

	if (!isPublishOutcome(published.outcome)) {
		return null;
	}

	return published.outcome;
}

export function workflowNoticeOf(value: string | null): WorkflowNotice | null {
	if (value === 'unpublished' || isPublishOutcome(value)) {
		return value;
	}

	return null;
}

export function savedDraftOf(data: unknown): SavedDraft | null {
	if (typeof data !== 'object' || data === null || !('saved' in data)) {
		return null;
	}

	const saved = data.saved;

	if (typeof saved !== 'object' || saved === null) {
		return null;
	}

	if (
		!('mode' in saved) ||
		!('version' in saved) ||
		!('slug' in saved) ||
		!('readingTimeMinutes' in saved) ||
		!('savedAt' in saved) ||
		!('snapshot' in saved)
	) {
		return null;
	}

	if (
		(saved.mode !== 'autosave' && saved.mode !== 'save') ||
		typeof saved.version !== 'number' ||
		typeof saved.slug !== 'string' ||
		typeof saved.readingTimeMinutes !== 'number' ||
		typeof saved.savedAt !== 'string' ||
		typeof saved.snapshot !== 'boolean'
	) {
		return null;
	}

	return {
		mode: saved.mode,
		version: saved.version,
		slug: saved.slug,
		readingTimeMinutes: saved.readingTimeMinutes,
		savedAt: saved.savedAt,
		snapshot: saved.snapshot
	};
}

export function errorCodeOf(data: unknown): string | undefined {
	if (typeof data !== 'object' || data === null || !('error' in data)) {
		return undefined;
	}

	if (typeof data.error === 'string') {
		return data.error;
	}

	return undefined;
}
