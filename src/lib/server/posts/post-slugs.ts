import { and, eq, ne, or } from 'drizzle-orm';
import { slugFromText, slugOrShortId, withNumericSuffix } from '../content/slugs';
import type { DatabaseExecutor } from '../db';
import { postRevisions, postTranslations } from '../db/schema';
import type { PostSlugRequest, PostSlugResult } from './post-slugs.interfaces';

const MAX_SLUG_ATTEMPTS = 50;

export function resolvePostSlug(db: DatabaseExecutor, request: PostSlugRequest): PostSlugResult {
	if (request.requested.trim() !== '') {
		const slug = slugFromText(request.requested, request.languageCode);

		if (slug === '') {
			return { status: 'invalid_slug' };
		}

		if (postSlugTaken(db, request.translationId, request.languageCode, slug)) {
			return { status: 'slug_taken' };
		}

		return { status: 'ok', slug };
	}

	if (!request.generate) {
		return { status: 'ok', slug: '' };
	}

	const base = slugOrShortId(request.title, request.languageCode);

	for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
		let candidate = base;

		if (attempt > 1) {
			candidate = withNumericSuffix(base, attempt);
		}

		if (!postSlugTaken(db, request.translationId, request.languageCode, candidate)) {
			return { status: 'ok', slug: candidate };
		}
	}

	return { status: 'slug_taken' };
}

export function postSlugTaken(
	db: DatabaseExecutor,
	translationId: string,
	languageCode: string,
	slug: string
): boolean {
	const live = db
		.select({ id: postTranslations.id })
		.from(postTranslations)
		.where(
			and(
				eq(postTranslations.languageCode, languageCode),
				eq(postTranslations.slug, slug),
				ne(postTranslations.id, translationId)
			)
		)
		.get();

	if (live !== undefined) {
		return true;
	}

	const draft = db
		.select({ id: postTranslations.id })
		.from(postTranslations)
		.innerJoin(
			postRevisions,
			or(
				eq(postRevisions.id, postTranslations.workingRevisionId),
				eq(postRevisions.id, postTranslations.pendingRevisionId)
			)
		)
		.where(
			and(
				eq(postTranslations.languageCode, languageCode),
				eq(postRevisions.slug, slug),
				ne(postTranslations.id, translationId)
			)
		)
		.get();

	return draft !== undefined;
}
