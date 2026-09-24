import { and, count, eq, inArray, max } from 'drizzle-orm';
import {
	categories,
	categoryTranslations,
	contentLanguages,
	postRevisionTags,
	postTranslations,
	posts,
	tags,
	user,
	userProfiles
} from '../db/schema';
import { apiMediaMap, mediaFrom } from './api-media';
import { apiCategories, modifiedAt, scopeConditions, selectCandidates } from './api-posts';
import { latestDate } from './api-response';
import type {
	ApiAuthor,
	ApiCategory,
	ApiLanguage,
	ApiList,
	ApiRequestContext,
	ApiResult,
	ApiTagSummary
} from './api.interfaces';

export function paginate<TItem>(items: TItem[], page: number, perPage: number): ApiList<TItem> {
	const start = (page - 1) * perPage;

	return {
		data: items.slice(start, start + perPage),
		meta: {
			page,
			per_page: perPage,
			total: items.length,
			total_pages: Math.ceil(items.length / perPage)
		}
	};
}

export function listApiLanguages(
	context: ApiRequestContext,
	page: number,
	perPage: number
): ApiResult<ApiList<ApiLanguage>> {
	const codes = context.languages.map((language) => language.code);
	let lastModified: Date | null = null;

	if (codes.length > 0) {
		lastModified =
			context.db
				.select({ updatedAt: max(contentLanguages.updatedAt) })
				.from(contentLanguages)
				.where(inArray(contentLanguages.code, codes))
				.get()?.updatedAt ?? null;
	}

	return {
		body: paginate(
			context.languages.map((language) => ({
				code: language.code,
				name: language.name,
				native_name: language.nativeName,
				is_default: language.isDefault
			})),
			page,
			perPage
		),
		lastModified
	};
}

export function listApiCategories(
	context: ApiRequestContext,
	page: number,
	perPage: number
): ApiResult<ApiList<ApiCategory>> {
	const rows = context.db
		.select({ id: categories.id, updatedAt: categories.updatedAt })
		.from(categories)
		.all()
		.filter(
			(row) => context.key.categories === null || context.key.categories.includes(row.id)
		);
	const byId = apiCategories(
		context,
		rows.map((row) => row.id)
	);
	const items = [...byId.values()]
		.filter((category) => category.translations.length > 0)
		.sort((first, second) =>
			first.translations[0].name.localeCompare(second.translations[0].name)
		);
	const translationUpdates = context.db
		.select({ updatedAt: max(categoryTranslations.updatedAt) })
		.from(categoryTranslations)
		.where(
			inArray(
				categoryTranslations.categoryId,
				items.map((item) => item.id)
			)
		)
		.get();

	return {
		body: paginate(items, page, perPage),
		lastModified: latestDate([
			...rows.filter((row) => byId.has(row.id)).map((row) => row.updatedAt),
			translationUpdates?.updatedAt ?? null
		])
	};
}

export function listApiTags(
	context: ApiRequestContext,
	languageCode: string,
	page: number,
	perPage: number
): ApiResult<ApiList<ApiTagSummary>> {
	const items = context.db
		.select({
			id: tags.id,
			name: tags.name,
			slug: tags.slug,
			language: tags.languageCode,
			postCount: count(postTranslations.id)
		})
		.from(postRevisionTags)
		.innerJoin(tags, eq(tags.id, postRevisionTags.tagId))
		.innerJoin(
			postTranslations,
			eq(postTranslations.liveRevisionId, postRevisionTags.revisionId)
		)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.where(and(...scopeConditions(context), eq(tags.languageCode, languageCode)))
		.groupBy(tags.id)
		.all()
		.map((row) => ({
			id: row.id,
			name: row.name,
			slug: row.slug,
			language: row.language,
			post_count: row.postCount
		}))
		.sort((first, second) => first.name.localeCompare(second.name));

	return {
		body: paginate(items, page, perPage),
		lastModified: latestDate(
			selectCandidates(context, [eq(postTranslations.languageCode, languageCode)]).map(
				modifiedAt
			)
		)
	};
}

export function listApiAuthors(
	context: ApiRequestContext,
	page: number,
	perPage: number
): ApiResult<ApiList<ApiAuthor>> {
	const rows = context.db
		.selectDistinct({
			id: user.id,
			name: user.name,
			updatedAt: user.updatedAt,
			bio: userProfiles.bio,
			avatarMediaId: userProfiles.avatarMediaId,
			profileUpdatedAt: userProfiles.updatedAt
		})
		.from(postTranslations)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.innerJoin(user, eq(user.id, posts.ownerId))
		.leftJoin(userProfiles, eq(userProfiles.userId, user.id))
		.where(and(...scopeConditions(context)))
		.all()
		.sort((first, second) => first.name.localeCompare(second.name));
	const mediaMap = apiMediaMap(
		context.db,
		context.origin,
		rows.map((row) => row.avatarMediaId),
		context.languages.map((language) => language.code)
	);

	return {
		body: paginate(
			rows.map((row) => ({
				id: row.id,
				name: row.name,
				bio: row.bio ?? '',
				avatar: mediaFrom(mediaMap, row.avatarMediaId)
			})),
			page,
			perPage
		),
		lastModified: latestDate(rows.flatMap((row) => [row.updatedAt, row.profileUpdatedAt]))
	};
}
