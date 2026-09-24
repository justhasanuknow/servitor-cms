import { z } from 'zod';
import { API_KEY_NAME_MAX_LENGTH } from '../../constants/api';
import { optionalCodeField, passwordField } from '../auth/form-fields';
import { formFields, formList } from '../http/form';
import { MAX_LANGUAGE_TAG_LENGTH } from '../languages/language-tags';
import { API_RATE_LIMIT_RANGE } from '../settings/system-settings';
import type { ApiKeyFormResult } from './api-key-form.interfaces';

const MAX_SCOPE_ENTRIES = 200;

const checkbox = z
	.literal('on')
	.optional()
	.transform((value) => value === 'on');

const createSchema = z.object({
	name: z.string().trim().min(1).max(API_KEY_NAME_MAX_LENGTH),
	allLanguages: checkbox,
	allCategories: checkbox,
	expiresOn: z.union([z.literal(''), z.iso.date()]).default(''),
	rateLimit: z
		.union([
			z.literal(''),
			z.coerce.number().int().min(API_RATE_LIMIT_RANGE.min).max(API_RATE_LIMIT_RANGE.max)
		])
		.default(''),
	password: passwordField,
	totpCode: optionalCodeField
});

const languageList = z.array(z.string().min(1).max(MAX_LANGUAGE_TAG_LENGTH));

const categoryList = z.array(z.uuid());

const confirmSchema = z.object({
	id: z.uuid(),
	password: passwordField,
	totpCode: optionalCodeField
});

export function readApiKeyForm(data: FormData): ApiKeyFormResult {
	const parsed = createSchema.safeParse(formFields(data));
	const languages = languageList.safeParse(formList(data, 'languages', MAX_SCOPE_ENTRIES));
	const categories = categoryList.safeParse(formList(data, 'categories', MAX_SCOPE_ENTRIES));

	if (!parsed.success || !languages.success || !categories.success) {
		return { status: 'invalid_input' };
	}

	const values = parsed.data;
	let languageScope: string[] | null = null;
	let categoryScope: string[] | null = null;
	let expiresAt: Date | null = null;
	let rateLimitPerMinute: number | null = null;

	if (!values.allLanguages) {
		if (languages.data.length === 0) {
			return { status: 'languages_required' };
		}

		languageScope = [...new Set(languages.data)];
	}

	if (!values.allCategories) {
		if (categories.data.length === 0) {
			return { status: 'categories_required' };
		}

		categoryScope = [...new Set(categories.data)];
	}

	if (values.expiresOn !== '') {
		expiresAt = new Date(`${values.expiresOn}T23:59:59.999Z`);
	}

	if (values.rateLimit !== '') {
		rateLimitPerMinute = values.rateLimit;
	}

	return {
		status: 'ok',
		input: {
			name: values.name,
			languages: languageScope,
			categories: categoryScope,
			expiresAt,
			rateLimitPerMinute
		},
		confirmation: { password: values.password, totpCode: values.totpCode }
	};
}

export function readApiKeyConfirmation(data: FormData) {
	const parsed = confirmSchema.safeParse(formFields(data));

	if (!parsed.success) {
		return null;
	}

	return {
		id: parsed.data.id,
		confirmation: { password: parsed.data.password, totpCode: parsed.data.totpCode }
	};
}
