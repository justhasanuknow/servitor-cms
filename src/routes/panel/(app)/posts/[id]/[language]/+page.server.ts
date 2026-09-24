import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { requireActor } from '$lib/server/auth/actor';
import { listCategories } from '$lib/server/categories/categories';
import { readFormFields } from '$lib/server/http/form';
import { defaultLanguageCode, listContentLanguages } from '$lib/server/languages/languages';
import { findMedia } from '$lib/server/media/media-library';
import { can, requirePermission } from '$lib/server/permissions/permissions';
import {
	languageParam,
	postIdParam,
	readDraftInput,
	readLanguageCode,
	readPostSettings,
	readScheduledAt
} from '$lib/server/posts/post-form';
import {
	addTranslation,
	deletePost,
	findPost,
	findTranslation,
	listTranslations,
	postSettingsLocked,
	postSubject,
	summarizeTranslations,
	updatePostSettings
} from '$lib/server/posts/posts';
import type { DraftSaveMode } from '$lib/server/posts/posts.interfaces';
import { loadTranslationEditor, saveTranslationDraft } from '$lib/server/posts/translation-drafts';
import { getRuntime } from '$lib/server/runtime';
import {
	publishFromEditor,
	translationWorkflowView,
	unpublishTranslation
} from '$lib/server/workflow/workflow';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

function editablePost(event: Pick<RequestEvent, 'locals' | 'params'>) {
	const { user } = requireActor(event.locals);
	const postId = postIdParam(event.params.id);
	const languageCode = languageParam(event.params.language);
	const post = findPost(getRuntime().db, postId);

	if (post === null) {
		error(404, { message: 'Not found' });
	}

	return { user, post, postId, languageCode };
}

function mediaPreview(id: string | null) {
	if (id === null) {
		return null;
	}

	const record = findMedia(getRuntime().db, id);

	if (record === null) {
		return null;
	}

	return { id: record.id, width: record.width, height: record.height };
}

async function saveDraft(event: RequestEvent, mode: DraftSaveMode) {
	const { user, postId, languageCode } = editablePost(event);
	const input = readDraftInput(await readFormFields(event.request));

	if (input === null) {
		return fail(400, { error: 'invalid_input' as const });
	}

	const result = saveTranslationDraft(getRuntime(), user, postId, languageCode, input, mode);

	if (result.status === 'not_found') {
		error(404, { message: 'Not found' });
	}

	if (result.status === 'conflict') {
		return fail(409, { error: result.status });
	}

	if (result.status !== 'saved') {
		return fail(400, { error: result.status });
	}

	return {
		saved: {
			mode,
			version: result.version,
			slug: result.slug,
			readingTimeMinutes: result.readingTimeMinutes,
			savedAt: result.savedAt.toISOString(),
			snapshot: result.snapshotId !== null
		}
	};
}

export const load: PageServerLoad = (event) => {
	const { user, post, postId, languageCode } = editablePost(event);
	const runtime = getRuntime();

	if (!can(user, 'post.edit', postSubject(post)) && can(user, 'post.view', postSubject(post))) {
		redirect(303, resolve(`/panel/posts/${postId}`));
	}

	requirePermission(user, 'post.edit', postSubject(post));

	const translation = findTranslation(runtime.db, postId, languageCode);

	if (translation === null) {
		error(404, { message: 'Not found' });
	}

	const editor = loadTranslationEditor(runtime, user, translation);

	return {
		post: {
			id: post.id,
			categoryId: post.categoryId,
			cover: mediaPreview(post.coverMediaId),
			hiddenByModerator: post.hiddenByModerator,
			hiddenReason: post.hiddenReason,
			settingsLocked: postSettingsLocked(runtime.db, user, postId)
		},
		editor,
		ogMedia: mediaPreview(editor.draft.ogMediaId),
		workflow: translationWorkflowView(runtime, user, post, translation),
		translations: summarizeTranslations(runtime.db, listTranslations(runtime.db, [postId])),
		languages: listContentLanguages(runtime.db),
		defaultLanguage: defaultLanguageCode(runtime.db),
		categories: listCategories(runtime.db)
	};
};

export const actions: Actions = {
	autosave: (event) => saveDraft(event, 'autosave'),
	save: (event) => saveDraft(event, 'save'),
	publish: async (event) => {
		const { user, postId, languageCode } = editablePost(event);
		const fields = await readFormFields(event.request);
		const input = readDraftInput(fields);
		const scheduledAt = readScheduledAt(fields.scheduledAt);

		if (input === null) {
			return fail(400, { error: 'invalid_input' as const });
		}

		if (scheduledAt === 'invalid') {
			return fail(400, { error: 'invalid_schedule' as const });
		}

		const result = publishFromEditor(
			getRuntime(),
			createAuthRequest(event),
			user,
			postId,
			languageCode,
			input,
			scheduledAt
		);

		if (result.status === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result.status === 'conflict') {
			return fail(409, { error: result.status });
		}

		if (result.status !== 'done') {
			return fail(400, { error: result.status });
		}

		return { published: { outcome: result.outcome } };
	},
	unpublish: (event) => {
		const { user, postId, languageCode } = editablePost(event);
		const result = unpublishTranslation(
			getRuntime(),
			createAuthRequest(event),
			user,
			postId,
			languageCode
		);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result !== 'unpublished') {
			return fail(400, { error: result });
		}

		return { unpublished: true };
	},
	settings: async (event) => {
		const { user, postId } = editablePost(event);
		const input = readPostSettings(await readFormFields(event.request));

		if (input === null) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = updatePostSettings(getRuntime(), user, postId, input);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result !== 'saved') {
			return fail(400, { error: result });
		}

		return { settingsSaved: true };
	},
	addTranslation: async (event) => {
		const { user, postId } = editablePost(event);
		const languageCode = readLanguageCode((await readFormFields(event.request)).languageCode);

		if (languageCode === null) {
			return fail(400, { error: 'unknown_language' as const });
		}

		const result = addTranslation(getRuntime(), user, postId, languageCode);

		if (result.status === 'not_found') {
			error(404, { message: 'Not found' });
		}

		if (result.status !== 'added') {
			return fail(400, { error: result.status });
		}

		redirect(303, resolve(`/panel/posts/${postId}/${result.languageCode}`));
	},
	delete: (event) => {
		const { user, postId } = editablePost(event);
		const result = deletePost(getRuntime(), createAuthRequest(event), user, postId);

		if (result === 'not_found') {
			error(404, { message: 'Not found' });
		}

		redirect(303, resolve('/panel/posts'));
	}
};
