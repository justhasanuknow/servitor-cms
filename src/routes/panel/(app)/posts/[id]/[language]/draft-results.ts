import type { SavedDraft } from './translation-editor.interfaces';

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
