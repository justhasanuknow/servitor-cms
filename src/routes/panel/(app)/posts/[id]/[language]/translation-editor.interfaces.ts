import type { ActionData, PageData } from './$types';

export interface TranslationEditorProps {
	data: PageData;
	form: ActionData;
}

export interface SavedDraft {
	mode: 'autosave' | 'save';
	version: number;
	slug: string;
	readingTimeMinutes: number;
	savedAt: string;
	snapshot: boolean;
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export type DraftSaveMode = 'autosave' | 'save';
