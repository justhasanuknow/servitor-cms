import { and, asc, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { PUBLIC_FEED_SIZE, PUBLIC_PAGE_SIZE } from '../../constants/public';
import type {
	PublicAlternate,
	PublicImage,
	PublicLanguage,
	PublicPostPage,
	PublicPostSummary,
	PublicPostView,
	PublicTerm
} from '../../modules/interfaces/public.interfaces';
import type { DatabaseExecutor } from '../db';
import {
	categoryTranslations,
	contentLanguages,
	media,
	mediaAltTexts,
	postRevisionTags,
	postRevisions,
	postTranslations,
	posts,
	tags,
	user
} from '../db/schema';
import type {
	PostViewSource,
	PublicFeedItem,
	PublicListFilter,
	PublicSitemapEntry,
	PublicTermRecord
} from './public-posts.interfaces';
import { publiclyVisible } from './visibility';

export function listPublicLanguages(db: DatabaseExecutor): PublicLanguage[] {
	return db
		.select({
			code: contentLanguages.code,
			name: contentLanguages.name,
			nativeName: contentLanguages.nativeName,
			isDefault: contentLanguages.isDefault
		})
		.from(contentLanguages)
		.where(eq(contentLanguages.enabled, true))
		.orderBy(asc(contentLanguages.sortOrder), asc(contentLanguages.name))
		.all();
}

export function findPublicLanguage(db: DatabaseExecutor, code: string): PublicLanguage | null {
	return listPublicLanguages(db).find((language) => language.code === code) ?? null;
}

export function listPublicPosts(
	db: DatabaseExecutor,
	languageCode: string,
	requestedPage: number,
	filter: PublicListFilter = {}
): PublicPostPage | null {
	const where = listingCondition(db, languageCode, filter);
	const total =
		db
			.select({ total: count() })
			.from(postTranslations)
			.innerJoin(posts, eq(posts.id, postTranslations.postId))
			.where(where)
			.get()?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PUBLIC_PAGE_SIZE));

	if (requestedPage > pageCount) {
		return null;
	}

	const rows = db
		.select({
			translationId: postTranslations.id,
			languageCode: postTranslations.languageCode,
			slug: postTranslations.slug,
			publishedAt: postTranslations.publishedAt,
			title: postRevisions.title,
			excerpt: postRevisions.excerpt,
			readingTimeMinutes: postRevisions.readingTimeMinutes,
			authorName: user.name,
			coverMediaId: posts.coverMediaId
		})
		.from(postTranslations)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.innerJoin(postRevisions, eq(postRevisions.id, postTranslations.liveRevisionId))
		.innerJoin(user, eq(user.id, posts.ownerId))
		.where(where)
		.orderBy(desc(postTranslations.publishedAt), desc(postTranslations.id))
		.limit(PUBLIC_PAGE_SIZE)
		.offset((requestedPage - 1) * PUBLIC_PAGE_SIZE)
		.all();
	const covers = publicImages(
		db,
		rows.map((row) => row.coverMediaId),
		languageCode
	);
	const items = rows.map((row): PublicPostSummary => ({
		translationId: row.translationId,
		languageCode: row.languageCode,
		slug: row.slug ?? '',
		title: row.title,
		excerpt: row.excerpt,
		authorName: row.authorName,
		publishedAt: row.publishedAt,
		readingTimeMinutes: row.readingTimeMinutes,
		cover: imageOf(covers, row.coverMediaId)
	}));

	return { items, page: requestedPage, pageCount, total };
}

export function findPublicPost(
	db: DatabaseExecutor,
	languageCode: string,
	slug: string
): PublicPostView | null {
	const row = db
		.select({
			translationId: postTranslations.id,
			postId: postTranslations.postId,
			languageCode: postTranslations.languageCode,
			liveRevisionId: postTranslations.liveRevisionId,
			publishedAt: postTranslations.publishedAt
		})
		.from(postTranslations)
		.where(
			and(
				publiclyVisible(db),
				eq(postTranslations.languageCode, languageCode),
				eq(postTranslations.slug, slug)
			)
		)
		.get();

	if (row === undefined || row.liveRevisionId === null) {
		return null;
	}

	return buildPostView(db, {
		translationId: row.translationId,
		postId: row.postId,
		languageCode: row.languageCode,
		revisionId: row.liveRevisionId,
		slug,
		publishedAt: row.publishedAt
	});
}

export function buildPostView(db: DatabaseExecutor, source: PostViewSource): PublicPostView | null {
	const revision = db
		.select({
			title: postRevisions.title,
			excerpt: postRevisions.excerpt,
			metaTitle: postRevisions.metaTitle,
			metaDescription: postRevisions.metaDescription,
			ogMediaId: postRevisions.ogMediaId,
			contentHtml: postRevisions.contentHtml,
			readingTimeMinutes: postRevisions.readingTimeMinutes,
			createdAt: postRevisions.createdAt
		})
		.from(postRevisions)
		.where(eq(postRevisions.id, source.revisionId))
		.get();
	const post = db
		.select({
			categoryId: posts.categoryId,
			coverMediaId: posts.coverMediaId,
			authorName: user.name
		})
		.from(posts)
		.innerJoin(user, eq(user.id, posts.ownerId))
		.where(eq(posts.id, source.postId))
		.get();

	if (revision === undefined || post === undefined) {
		return null;
	}

	const images = publicImages(db, [post.coverMediaId, revision.ogMediaId], source.languageCode);

	return {
		translationId: source.translationId,
		postId: source.postId,
		languageCode: source.languageCode,
		slug: source.slug,
		title: revision.title,
		excerpt: revision.excerpt,
		metaTitle: revision.metaTitle,
		metaDescription: revision.metaDescription,
		contentHtml: revision.contentHtml,
		readingTimeMinutes: revision.readingTimeMinutes,
		publishedAt: source.publishedAt,
		modifiedAt: latest(source.publishedAt, revision.createdAt),
		authorName: post.authorName,
		category: categoryTerm(db, post.categoryId, source.languageCode),
		tags: revisionTags(db, source.revisionId),
		cover: imageOf(images, post.coverMediaId),
		ogImage: imageOf(images, revision.ogMediaId),
		alternates: publicAlternates(db, source.postId)
	};
}

export function findPublicCategory(
	db: DatabaseExecutor,
	languageCode: string,
	slug: string
): PublicTermRecord | null {
	const row = db
		.select({
			id: categoryTranslations.categoryId,
			name: categoryTranslations.name,
			slug: categoryTranslations.slug
		})
		.from(categoryTranslations)
		.where(
			and(
				eq(categoryTranslations.languageCode, languageCode),
				eq(categoryTranslations.slug, slug)
			)
		)
		.get();

	return row ?? null;
}

export function findPublicTag(
	db: DatabaseExecutor,
	languageCode: string,
	slug: string
): PublicTermRecord | null {
	const tag = db
		.select({ id: tags.id, name: tags.name, slug: tags.slug })
		.from(tags)
		.where(and(eq(tags.languageCode, languageCode), eq(tags.slug, slug)))
		.get();

	if (tag === undefined) {
		return null;
	}

	const used = db
		.select({ id: postTranslations.id })
		.from(postTranslations)
		.where(and(publiclyVisible(db), taggedWith(db, tag.id)))
		.limit(1)
		.get();

	if (used === undefined) {
		return null;
	}

	return tag;
}

export function listFeedItems(
	db: DatabaseExecutor,
	languageCode: string,
	limit: number = PUBLIC_FEED_SIZE
): PublicFeedItem[] {
	return db
		.select({
			translationId: postTranslations.id,
			slug: postTranslations.slug,
			publishedAt: postTranslations.publishedAt,
			title: postRevisions.title,
			excerpt: postRevisions.excerpt,
			contentHtml: postRevisions.contentHtml,
			authorName: user.name
		})
		.from(postTranslations)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.innerJoin(postRevisions, eq(postRevisions.id, postTranslations.liveRevisionId))
		.innerJoin(user, eq(user.id, posts.ownerId))
		.where(listingCondition(db, languageCode, {}))
		.orderBy(desc(postTranslations.publishedAt), desc(postTranslations.id))
		.limit(limit)
		.all()
		.map((row) => ({ ...row, slug: row.slug ?? '' }));
}

export function listSitemapEntries(
	db: DatabaseExecutor,
	languageCode: string
): PublicSitemapEntry[] {
	return db
		.select({
			slug: postTranslations.slug,
			publishedAt: postTranslations.publishedAt,
			revisedAt: postRevisions.createdAt
		})
		.from(postTranslations)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.innerJoin(postRevisions, eq(postRevisions.id, postTranslations.liveRevisionId))
		.where(listingCondition(db, languageCode, {}))
		.orderBy(desc(postTranslations.publishedAt), desc(postTranslations.id))
		.all()
		.map((row) => ({
			slug: row.slug ?? '',
			modifiedAt: latest(row.publishedAt, row.revisedAt)
		}));
}

function listingCondition(
	db: DatabaseExecutor,
	languageCode: string,
	filter: PublicListFilter
): SQL | undefined {
	const conditions = [publiclyVisible(db), eq(postTranslations.languageCode, languageCode)];

	if (filter.categoryId !== undefined) {
		conditions.push(eq(posts.categoryId, filter.categoryId));
	}

	if (filter.tagId !== undefined) {
		conditions.push(taggedWith(db, filter.tagId));
	}

	return and(...conditions);
}

function taggedWith(db: DatabaseExecutor, tagId: string): SQL {
	return inArray(
		postTranslations.liveRevisionId,
		db
			.select({ id: postRevisionTags.revisionId })
			.from(postRevisionTags)
			.where(eq(postRevisionTags.tagId, tagId))
	);
}

function publicAlternates(db: DatabaseExecutor, postId: string): PublicAlternate[] {
	return db
		.select({
			languageCode: postTranslations.languageCode,
			nativeName: contentLanguages.nativeName,
			slug: postTranslations.slug
		})
		.from(postTranslations)
		.innerJoin(contentLanguages, eq(contentLanguages.code, postTranslations.languageCode))
		.where(and(publiclyVisible(db), eq(postTranslations.postId, postId)))
		.orderBy(asc(contentLanguages.sortOrder), asc(contentLanguages.name))
		.all()
		.map((row) => ({ ...row, slug: row.slug ?? '' }));
}

function categoryTerm(
	db: DatabaseExecutor,
	categoryId: string | null,
	languageCode: string
): PublicTerm | null {
	if (categoryId === null) {
		return null;
	}

	const row = db
		.select({ name: categoryTranslations.name, slug: categoryTranslations.slug })
		.from(categoryTranslations)
		.where(
			and(
				eq(categoryTranslations.categoryId, categoryId),
				eq(categoryTranslations.languageCode, languageCode)
			)
		)
		.get();

	return row ?? null;
}

function revisionTags(db: DatabaseExecutor, revisionId: string): PublicTerm[] {
	return db
		.select({ name: tags.name, slug: tags.slug })
		.from(postRevisionTags)
		.innerJoin(tags, eq(tags.id, postRevisionTags.tagId))
		.where(eq(postRevisionTags.revisionId, revisionId))
		.orderBy(asc(tags.name))
		.all();
}

function publicImages(
	db: DatabaseExecutor,
	ids: (string | null)[],
	languageCode: string
): Map<string, PublicImage> {
	const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
	const images = new Map<string, PublicImage>();

	if (wanted.length === 0) {
		return images;
	}

	const altTexts = new Map(
		db
			.select({ mediaId: mediaAltTexts.mediaId, altText: mediaAltTexts.altText })
			.from(mediaAltTexts)
			.where(
				and(
					inArray(mediaAltTexts.mediaId, wanted),
					eq(mediaAltTexts.languageCode, languageCode)
				)
			)
			.all()
			.map((row) => [row.mediaId, row.altText])
	);

	for (const row of db
		.select({ id: media.id, width: media.width, height: media.height })
		.from(media)
		.where(and(inArray(media.id, wanted), eq(media.kind, 'library')))
		.all()) {
		images.set(row.id, { ...row, alt: altTexts.get(row.id) ?? '' });
	}

	return images;
}

function imageOf(images: Map<string, PublicImage>, id: string | null): PublicImage | null {
	if (id === null) {
		return null;
	}

	return images.get(id) ?? null;
}

function latest(first: Date | null, second: Date): Date {
	if (first !== null && first.getTime() > second.getTime()) {
		return first;
	}

	return second;
}
