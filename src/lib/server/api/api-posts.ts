import { and, asc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import type { ApiContentFormat, ApiSortField, ApiSortOrder } from '../../constants/api';
import { absoluteUrl, blogPostPath } from '../../public/paths';
import {
	categoryTranslations,
	postRevisionTags,
	postRevisions,
	postTranslations,
	posts,
	tags,
	user,
	userProfiles
} from '../db/schema';
import { taggedWith } from '../public/public-posts';
import { publiclyVisible } from '../public/visibility';
import { apiMediaMap, mediaFrom } from './api-media';
import { latestDate } from './api-response';
import { searchCondition } from './api-search';
import type {
	ApiCategory,
	ApiItem,
	ApiList,
	ApiPost,
	ApiPostFilters,
	ApiRequestContext,
	ApiResult,
	ApiTag,
	ApiTranslation,
	TranslationCandidate
} from './api.interfaces';

export function scopeConditions(context: ApiRequestContext): SQL[] {
	const conditions = [
		publiclyVisible(context.db),
		inArray(
			postTranslations.languageCode,
			context.languages.map((language) => language.code)
		)
	];

	if (context.key.categories !== null) {
		conditions.push(inArray(posts.categoryId, context.key.categories));
	}

	return conditions;
}

export function selectCandidates(context: ApiRequestContext, extra: SQL[]): TranslationCandidate[] {
	return context.db
		.select({
			translationId: postTranslations.id,
			postId: postTranslations.postId,
			languageCode: postTranslations.languageCode,
			publishedAt: postTranslations.publishedAt,
			revisedAt: postRevisions.createdAt
		})
		.from(postTranslations)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.innerJoin(postRevisions, eq(postRevisions.id, postTranslations.liveRevisionId))
		.where(and(...scopeConditions(context), ...extra))
		.all();
}

export function modifiedAt(candidate: TranslationCandidate): Date {
	return latestDate([candidate.publishedAt, candidate.revisedAt]) ?? candidate.revisedAt;
}

export function listApiPosts(
	context: ApiRequestContext,
	filters: ApiPostFilters
): ApiResult<ApiList<ApiPost>> {
	const groups = chooseTranslations(
		context,
		groupByPost(selectCandidates(context, filterConditions(context, filters))),
		filters
	);
	const ordered = sortPosts([...groups], filters.sort, filters.order);
	const start = (filters.page - 1) * filters.perPage;
	const pageEntries = ordered.slice(start, start + filters.perPage);
	const data = buildPosts(context, pageEntries, filters.contentFormat);

	return {
		body: {
			data,
			meta: {
				page: filters.page,
				per_page: filters.perPage,
				total: ordered.length,
				total_pages: Math.ceil(ordered.length / filters.perPage)
			}
		},
		lastModified: latestDate(pageEntries.flatMap(([, rows]) => rows.map(modifiedAt)))
	};
}

export function findApiPost(
	context: ApiRequestContext,
	postId: string,
	contentFormat: ApiContentFormat
): ApiResult<ApiItem<ApiPost>> | null {
	const rows = selectCandidates(context, [eq(postTranslations.postId, postId)]);
	const [post] = buildPosts(context, [[postId, rows]], contentFormat);

	if (rows.length === 0 || post === undefined) {
		return null;
	}

	return { body: { data: post }, lastModified: latestDate(rows.map(modifiedAt)) };
}

export function findApiPostBySlug(
	context: ApiRequestContext,
	languageCode: string,
	slug: string,
	contentFormat: ApiContentFormat
): ApiResult<ApiItem<ApiPost>> | null {
	const [match] = selectCandidates(context, [
		eq(postTranslations.languageCode, languageCode),
		eq(postTranslations.slug, slug)
	]);

	if (match === undefined) {
		return null;
	}

	return findApiPost(context, match.postId, contentFormat);
}

function filterConditions(context: ApiRequestContext, filters: ApiPostFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.categoryId !== null) {
		conditions.push(eq(posts.categoryId, filters.categoryId));
	}

	if (filters.authorId !== null) {
		conditions.push(eq(posts.ownerId, filters.authorId));
	}

	if (filters.tagId !== null) {
		conditions.push(taggedWith(context.db, filters.tagId));
	}

	if (filters.search !== null) {
		conditions.push(searchCondition(filters.search));
	}

	if (filters.publishedFrom !== null) {
		conditions.push(gte(postTranslations.publishedAt, filters.publishedFrom));
	}

	if (filters.publishedTo !== null) {
		conditions.push(lte(postTranslations.publishedAt, filters.publishedTo));
	}

	return conditions;
}

function groupByPost(rows: TranslationCandidate[]): Map<string, TranslationCandidate[]> {
	const groups = new Map<string, TranslationCandidate[]>();

	for (const row of rows) {
		groups.set(row.postId, [...(groups.get(row.postId) ?? []), row]);
	}

	return groups;
}

function chooseTranslations(
	context: ApiRequestContext,
	groups: Map<string, TranslationCandidate[]>,
	filters: ApiPostFilters
): Map<string, TranslationCandidate[]> {
	if (filters.languages === null) {
		return groups;
	}

	const requested = new Set(filters.languages);
	const chosen = new Map<string, TranslationCandidate[]>();
	let published: Map<string, Set<string>> | null = null;

	for (const [postId, rows] of groups) {
		const matching = rows.filter((row) => requested.has(row.languageCode));

		if (matching.length > 0) {
			chosen.set(postId, matching);

			continue;
		}

		if (!filters.fallback || context.defaultLanguage === null) {
			continue;
		}

		published ??= publishedLanguages(context);

		const languages = published.get(postId) ?? new Set<string>();

		if ([...requested].some((code) => languages.has(code))) {
			continue;
		}

		const fallback = rows.filter((row) => row.languageCode === context.defaultLanguage);

		if (fallback.length > 0) {
			chosen.set(postId, fallback);
		}
	}

	return chosen;
}

function publishedLanguages(context: ApiRequestContext): Map<string, Set<string>> {
	const languages = new Map<string, Set<string>>();

	for (const row of context.db
		.select({ postId: postTranslations.postId, languageCode: postTranslations.languageCode })
		.from(postTranslations)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.where(and(...scopeConditions(context)))
		.all()) {
		languages.set(row.postId, (languages.get(row.postId) ?? new Set()).add(row.languageCode));
	}

	return languages;
}

function sortValue(rows: TranslationCandidate[], sort: ApiSortField): number {
	if (sort === 'updated_at') {
		return Math.max(...rows.map((row) => modifiedAt(row).getTime()));
	}

	return Math.min(...rows.map((row) => row.publishedAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
}

function sortPosts(
	entries: [string, TranslationCandidate[]][],
	sort: ApiSortField,
	order: ApiSortOrder
): [string, TranslationCandidate[]][] {
	let direction = 1;

	if (order === 'desc') {
		direction = -1;
	}

	return entries
		.map((entry) => ({ entry, value: sortValue(entry[1], sort) }))
		.sort(
			(first, second) =>
				(first.value - second.value) * direction ||
				first.entry[0].localeCompare(second.entry[0])
		)
		.map(({ entry }) => entry);
}

function buildPosts(
	context: ApiRequestContext,
	entries: [string, TranslationCandidate[]][],
	contentFormat: ApiContentFormat
): ApiPost[] {
	const postIds = entries.map(([postId]) => postId);
	const translationIds = entries.flatMap(([, rows]) => rows.map((row) => row.translationId));

	if (postIds.length === 0 || translationIds.length === 0) {
		return [];
	}

	const { db } = context;
	const languageCodes = context.languages.map((language) => language.code);
	const languageOrder = new Map(languageCodes.map((code, index) => [code, index]));
	const postRows = new Map(
		db
			.select({
				id: posts.id,
				categoryId: posts.categoryId,
				coverMediaId: posts.coverMediaId,
				authorId: user.id,
				authorName: user.name,
				bio: userProfiles.bio,
				avatarMediaId: userProfiles.avatarMediaId
			})
			.from(posts)
			.innerJoin(user, eq(user.id, posts.ownerId))
			.leftJoin(userProfiles, eq(userProfiles.userId, user.id))
			.where(inArray(posts.id, postIds))
			.all()
			.map((row) => [row.id, row])
	);
	const translationRows = db
		.select({
			id: postTranslations.id,
			postId: postTranslations.postId,
			languageCode: postTranslations.languageCode,
			slug: postTranslations.slug,
			publishedAt: postTranslations.publishedAt,
			revisionId: postRevisions.id,
			title: postRevisions.title,
			excerpt: postRevisions.excerpt,
			metaTitle: postRevisions.metaTitle,
			metaDescription: postRevisions.metaDescription,
			ogMediaId: postRevisions.ogMediaId,
			readingTimeMinutes: postRevisions.readingTimeMinutes,
			contentHtml: postRevisions.contentHtml,
			contentJson: postRevisions.contentJson,
			revisedAt: postRevisions.createdAt
		})
		.from(postTranslations)
		.innerJoin(postRevisions, eq(postRevisions.id, postTranslations.liveRevisionId))
		.where(inArray(postTranslations.id, translationIds))
		.all()
		.sort(
			(first, second) =>
				(languageOrder.get(first.languageCode) ?? 0) -
				(languageOrder.get(second.languageCode) ?? 0)
		);
	const tagsByRevision = revisionTags(
		context,
		translationRows.map((row) => row.revisionId)
	);
	const categoriesById = apiCategories(
		context,
		[...postRows.values()].map((row) => row.categoryId)
	);
	const mediaMap = apiMediaMap(
		db,
		context.origin,
		[
			...[...postRows.values()].flatMap((row) => [row.coverMediaId, row.avatarMediaId]),
			...translationRows.map((row) => row.ogMediaId)
		],
		languageCodes
	);

	return postIds.flatMap((postId): ApiPost[] => {
		const post = postRows.get(postId);
		const translations = translationRows.filter((row) => row.postId === postId);

		if (post === undefined || translations.length === 0) {
			return [];
		}

		const published = translations
			.map((row) => row.publishedAt)
			.filter((date): date is Date => date !== null)
			.sort((first, second) => first.getTime() - second.getTime());
		const updated =
			latestDate(translations.flatMap((row) => [row.publishedAt, row.revisedAt])) ??
			translations[0].revisedAt;

		return [
			{
				id: postId,
				author: {
					id: post.authorId,
					name: post.authorName,
					bio: post.bio ?? '',
					avatar: mediaFrom(mediaMap, post.avatarMediaId)
				},
				category: categoryOf(categoriesById, post.categoryId),
				cover: mediaFrom(mediaMap, post.coverMediaId),
				published_at: published[0]?.toISOString() ?? null,
				updated_at: updated.toISOString(),
				translations: translations.map((row) => {
					const translation: ApiTranslation = {
						id: row.id,
						language: row.languageCode,
						slug: row.slug ?? '',
						url: publicUrl(context, row.languageCode, row.slug),
						title: row.title,
						excerpt: row.excerpt,
						meta_title: row.metaTitle,
						meta_description: row.metaDescription,
						og_image: mediaFrom(mediaMap, row.ogMediaId),
						tags: tagsByRevision.get(row.revisionId) ?? [],
						reading_time_minutes: row.readingTimeMinutes,
						published_at: row.publishedAt?.toISOString() ?? null,
						updated_at: (
							latestDate([row.publishedAt, row.revisedAt]) ?? row.revisedAt
						).toISOString()
					};

					if (contentFormat !== 'json') {
						translation.content_html = row.contentHtml;
					}

					if (contentFormat !== 'html') {
						translation.content_json = JSON.parse(row.contentJson);
					}

					return translation;
				})
			}
		];
	});
}

function publicUrl(
	context: ApiRequestContext,
	languageCode: string,
	slug: string | null
): string | null {
	if (!context.publicSiteEnabled || slug === null) {
		return null;
	}

	return absoluteUrl(context.origin, blogPostPath(languageCode, slug));
}

function revisionTags(context: ApiRequestContext, revisionIds: string[]): Map<string, ApiTag[]> {
	const result = new Map<string, ApiTag[]>();

	if (revisionIds.length === 0) {
		return result;
	}

	for (const row of context.db
		.select({
			revisionId: postRevisionTags.revisionId,
			id: tags.id,
			name: tags.name,
			slug: tags.slug
		})
		.from(postRevisionTags)
		.innerJoin(tags, eq(tags.id, postRevisionTags.tagId))
		.where(inArray(postRevisionTags.revisionId, revisionIds))
		.orderBy(asc(tags.name))
		.all()) {
		result.set(row.revisionId, [
			...(result.get(row.revisionId) ?? []),
			{ id: row.id, name: row.name, slug: row.slug }
		]);
	}

	return result;
}

export function apiCategories(
	context: ApiRequestContext,
	categoryIds: (string | null)[]
): Map<string, ApiCategory> {
	const wanted = [...new Set(categoryIds.filter((id): id is string => id !== null))];
	const result = new Map<string, ApiCategory>();
	const languageOrder = new Map(
		context.languages.map((language, index) => [language.code, index])
	);

	if (wanted.length === 0) {
		return result;
	}

	const rows = context.db
		.select()
		.from(categoryTranslations)
		.where(
			and(
				inArray(categoryTranslations.categoryId, wanted),
				inArray(
					categoryTranslations.languageCode,
					context.languages.map((language) => language.code)
				)
			)
		)
		.all()
		.sort(
			(first, second) =>
				(languageOrder.get(first.languageCode) ?? 0) -
				(languageOrder.get(second.languageCode) ?? 0)
		);

	for (const id of wanted) {
		result.set(id, {
			id,
			translations: rows
				.filter((row) => row.categoryId === id)
				.map((row) => ({ language: row.languageCode, name: row.name, slug: row.slug }))
		});
	}

	return result;
}

function categoryOf(categories: Map<string, ApiCategory>, id: string | null): ApiCategory | null {
	if (id === null) {
		return null;
	}

	return categories.get(id) ?? null;
}
