import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { MAX_PUBLIC_PAGE } from '../../constants/public';
import type { PublicLanguage } from '../../modules/interfaces/public.interfaces';
import { isValidSlug } from '../content/slugs';
import type { DatabaseExecutor } from '../db';
import { readLanguageCode } from '../posts/post-form';
import { loadSystemSettings } from '../settings/system-settings';
import type { SystemSettingsView } from '../settings/system-settings.interfaces';
import { findPublicLanguage } from './public-posts';

const pageSchema = z.coerce.number().int().min(1).max(MAX_PUBLIC_PAGE);

function notFound(): never {
	error(404, { message: 'Not found' });
}

export function requirePublicSite(db: DatabaseExecutor): SystemSettingsView {
	const settings = loadSystemSettings(db);

	if (!settings.publicSiteEnabled) {
		notFound();
	}

	return settings;
}

export function publicLanguageParam(db: DatabaseExecutor, value: string): PublicLanguage {
	const code = readLanguageCode(value);

	if (code === null) {
		notFound();
	}

	const language = findPublicLanguage(db, code);

	if (language === null) {
		notFound();
	}

	return language;
}

export function slugParam(value: string): string {
	if (!isValidSlug(value)) {
		notFound();
	}

	return value;
}

export function pageParam(url: URL): number {
	const value = url.searchParams.get('page');

	if (value === null) {
		return 1;
	}

	const parsed = pageSchema.safeParse(value);

	if (!parsed.success || String(parsed.data) !== value) {
		notFound();
	}

	return parsed.data;
}
