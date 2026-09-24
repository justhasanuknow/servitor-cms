import type { RevisionReviewState, TranslationStatus } from '$lib/constants/content';
import { m } from '$lib/paraglide/messages';
import type { LanguageLabelSource } from './post-messages.interfaces';

export function translationStatusLabel(status: TranslationStatus): string {
	switch (status) {
		case 'pending_review':
			return m.post_status_pending_review();
		case 'scheduled':
			return m.post_status_scheduled();
		case 'published':
			return m.post_status_published();
		case 'unpublished':
			return m.post_status_unpublished();
		default:
			return m.post_status_draft();
	}
}

export function reviewStateLabel(state: RevisionReviewState): string | null {
	switch (state) {
		case 'pending':
			return m.revision_review_pending();
		case 'approved':
			return m.revision_review_approved();
		case 'rejected':
			return m.revision_review_rejected();
		default:
			return null;
	}
}

export function languageLabel(languages: LanguageLabelSource[], code: string): string {
	const language = languages.find((entry) => entry.code === code);

	if (language === undefined) {
		return code;
	}

	return language.nativeName;
}

export function postTitle(title: string): string {
	if (title.trim() === '') {
		return m.posts_untitled();
	}

	return title;
}

export function postErrorMessage(error: string | undefined): string | null {
	switch (error) {
		case undefined:
			return null;
		case 'invalid_input':
			return m.posts_error_invalid_input();
		case 'unknown_language':
			return m.posts_error_unknown_language();
		case 'exists':
			return m.posts_error_translation_exists();
		case 'unknown_category':
			return m.posts_error_unknown_category();
		case 'invalid_media':
			return m.posts_error_invalid_media();
		case 'locked':
			return m.posts_error_settings_locked();
		case 'conflict':
			return m.posts_error_conflict();
		case 'invalid_content':
			return m.posts_error_invalid_content();
		case 'content_too_large':
			return m.posts_error_content_too_large();
		case 'invalid_slug':
			return m.posts_error_invalid_slug();
		case 'slug_taken':
			return m.posts_error_slug_taken();
		case 'title_required':
			return m.posts_error_title_required();
		case 'too_many_tags':
			return m.posts_error_too_many_tags();
		case 'tag_too_long':
			return m.posts_error_tag_too_long();
		case 'invalid_schedule':
			return m.posts_error_invalid_schedule();
		case 'not_allowed':
			return m.posts_error_not_allowed();
		default:
			return m.posts_error_generic();
	}
}

export function reviewErrorMessage(error: string | undefined): string | null {
	switch (error) {
		case undefined:
			return null;
		case 'stale':
			return m.reviews_error_stale();
		case 'note_required':
			return m.reviews_error_note_required();
		case 'slug_taken':
			return m.reviews_error_slug_taken();
		case 'not_allowed':
			return m.reviews_error_not_allowed();
		default:
			return m.posts_error_invalid_input();
	}
}

export function moderationErrorMessage(error: string | undefined): string | null {
	switch (error) {
		case undefined:
			return null;
		case 'reason_required':
			return m.moderation_error_reason();
		case 'already_hidden':
		case 'not_hidden':
			return m.moderation_error_state();
		default:
			return m.posts_error_invalid_input();
	}
}
