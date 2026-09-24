import type { AuthUser } from '../auth/auth';
import { createPost, findTranslation } from '../posts/posts';
import type { TranslationDraftInput, TranslationRecord } from '../posts/posts.interfaces';
import { loadTranslationEditor, saveTranslationDraft } from '../posts/translation-drafts';
import type { Runtime } from '../runtime.interfaces';
import { publishFromEditor } from '../workflow/workflow';
import type { AuthRequest } from '../auth/auth-request.interfaces';

export function paragraphs(...texts: string[]): string {
	return JSON.stringify({
		type: 'doc',
		content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
	});
}

export function createTestPost(runtime: Runtime, owner: AuthUser, languageCode = 'en'): string {
	const result = createPost(runtime, owner, languageCode);

	if (result.status !== 'created') {
		throw new Error(`Expected the post to be created, got ${result.status}`);
	}

	return result.postId;
}

export function requireTranslation(
	runtime: Runtime,
	postId: string,
	languageCode = 'en'
): TranslationRecord {
	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null) {
		throw new Error('Expected a translation');
	}

	return translation;
}

export function draftInput(
	runtime: Runtime,
	owner: AuthUser,
	postId: string,
	overrides: Partial<TranslationDraftInput>,
	languageCode = 'en'
): TranslationDraftInput {
	const translation = requireTranslation(runtime, postId, languageCode);
	const current = loadTranslationEditor(runtime, owner, translation).draft;

	return {
		title: current.title,
		slug: current.slug,
		excerpt: current.excerpt,
		metaTitle: null,
		metaDescription: null,
		ogMediaId: current.ogMediaId,
		tags: current.tags.join(', '),
		content: current.content,
		version: current.version,
		...overrides
	};
}

export function saveTestDraft(
	runtime: Runtime,
	owner: AuthUser,
	postId: string,
	overrides: Partial<TranslationDraftInput>,
	languageCode = 'en'
) {
	return saveTranslationDraft(
		runtime,
		owner,
		postId,
		languageCode,
		draftInput(runtime, owner, postId, overrides, languageCode),
		'save'
	);
}

export function publishTestDraft(
	runtime: Runtime,
	request: AuthRequest,
	owner: AuthUser,
	postId: string,
	overrides: Partial<TranslationDraftInput>,
	languageCode = 'en',
	scheduledAt: Date | null = null
) {
	return publishFromEditor(
		runtime,
		request,
		owner,
		postId,
		languageCode,
		draftInput(runtime, owner, postId, overrides, languageCode),
		scheduledAt
	);
}
