import { error } from '@sveltejs/kit';
import { z } from 'zod';
import {
	MAX_CONTENT_JSON_LENGTH,
	META_DESCRIPTION_MAX_LENGTH,
	META_TITLE_MAX_LENGTH,
	POST_EXCERPT_MAX_LENGTH,
	POST_TITLE_MAX_LENGTH,
	TAG_INPUT_MAX_LENGTH
} from '../../constants/content';
import { MAX_SLUG_LENGTH } from '../content/slugs';
import { isLanguageTag, MAX_LANGUAGE_TAG_LENGTH } from '../languages/language-tags';
import type { PostSettingsInput, TranslationDraftInput } from './posts.interfaces';

const VERSION_PATTERN = /^[0-9]{1,16}$/;

const MAX_SCHEDULE_YEARS = 10;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const scheduleSchema = z.union([z.literal(''), z.iso.datetime({ offset: true })]);

const optionalId = z.union([z.literal(''), z.uuid()]);

const draftSchema = z.object({
	title: z.string().trim().max(POST_TITLE_MAX_LENGTH),
	slug: z.string().trim().max(MAX_SLUG_LENGTH),
	excerpt: z.string().trim().max(POST_EXCERPT_MAX_LENGTH),
	metaTitle: z.string().trim().max(META_TITLE_MAX_LENGTH),
	metaDescription: z.string().trim().max(META_DESCRIPTION_MAX_LENGTH),
	ogMediaId: optionalId,
	tags: z.string().max(TAG_INPUT_MAX_LENGTH),
	content: z.string().min(1).max(MAX_CONTENT_JSON_LENGTH),
	version: z.string().regex(VERSION_PATTERN).transform(Number)
});

const settingsSchema = z.object({
	categoryId: optionalId,
	coverMediaId: optionalId
});

const postIdSchema = z.uuid();

const languageSchema = z.string().min(1).max(MAX_LANGUAGE_TAG_LENGTH).refine(isLanguageTag);

export function readDraftInput(
	fields: Record<string, string | undefined>
): TranslationDraftInput | null {
	const parsed = draftSchema.safeParse(fields);

	if (!parsed.success) {
		return null;
	}

	return {
		...parsed.data,
		metaTitle: emptyToNull(parsed.data.metaTitle),
		metaDescription: emptyToNull(parsed.data.metaDescription),
		ogMediaId: emptyToNull(parsed.data.ogMediaId)
	};
}

export function readPostSettings(
	fields: Record<string, string | undefined>
): PostSettingsInput | null {
	const parsed = settingsSchema.safeParse(fields);

	if (!parsed.success) {
		return null;
	}

	return {
		categoryId: emptyToNull(parsed.data.categoryId),
		coverMediaId: emptyToNull(parsed.data.coverMediaId)
	};
}

export function readScheduledAt(
	value: string | undefined,
	now: Date = new Date()
): Date | null | 'invalid' {
	const parsed = scheduleSchema.safeParse(value ?? '');

	if (!parsed.success) {
		return 'invalid';
	}

	if (parsed.data === '') {
		return null;
	}

	const scheduledAt = new Date(parsed.data);

	if (Math.abs(scheduledAt.getTime() - now.getTime()) > MAX_SCHEDULE_YEARS * YEAR_MS) {
		return 'invalid';
	}

	return scheduledAt;
}

export function readLanguageCode(value: string | undefined): string | null {
	const parsed = languageSchema.safeParse(value);

	if (!parsed.success) {
		return null;
	}

	return parsed.data;
}

export function postIdParam(value: string): string {
	const parsed = postIdSchema.safeParse(value);

	if (!parsed.success) {
		error(404, { message: 'Not found' });
	}

	return parsed.data;
}

export function languageParam(value: string): string {
	const parsed = readLanguageCode(value);

	if (parsed === null) {
		error(404, { message: 'Not found' });
	}

	return parsed;
}

function emptyToNull(value: string): string | null {
	if (value === '') {
		return null;
	}

	return value;
}
