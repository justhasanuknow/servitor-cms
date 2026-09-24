import { and, asc, count, desc, eq, inArray, isNotNull, type SQL } from 'drizzle-orm';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { emptyContentDocument } from '../content/content-schema';
import { renderContentDocument } from '../content/render-content';
import type { AppDatabase, DatabaseExecutor } from '../db';
import {
	categories,
	contentLanguages,
	postRevisions,
	postTranslations,
	posts,
	user
} from '../db/schema';
import { unusableMediaIds } from '../media/media-library';
import { can, publishesDirectly, requirePermission } from '../permissions/permissions';
import type { PostSubject } from '../permissions/permissions.interfaces';
import type { Runtime } from '../runtime.interfaces';
import { enqueuePostEvent } from '../webhooks/outbox';
import type {
	PostCreateResult,
	PostDeleteResult,
	PostListItem,
	PostListPage,
	PostRecord,
	PostSettingsInput,
	PostSettingsResult,
	TranslationAddResult,
	TranslationRecord,
	TranslationSummary
} from './posts.interfaces';
import { insertRevision } from './revision-store';

export const POST_PAGE_SIZE = 25;

export function findPost(db: DatabaseExecutor, postId: string): PostRecord | null {
	const row = db
		.select({
			id: posts.id,
			ownerId: posts.ownerId,
			ownerRole: user.role,
			ownerName: user.name,
			categoryId: posts.categoryId,
			coverMediaId: posts.coverMediaId,
			hiddenByModerator: posts.hiddenByModerator,
			hiddenReason: posts.hiddenReason,
			createdAt: posts.createdAt,
			updatedAt: posts.updatedAt
		})
		.from(posts)
		.innerJoin(user, eq(user.id, posts.ownerId))
		.where(eq(posts.id, postId))
		.get();

	return row ?? null;
}

export function postSubject(post: PostRecord): PostSubject {
	return { ownerId: post.ownerId, ownerRole: post.ownerRole };
}

export function listTranslations(db: DatabaseExecutor, postIds: string[]): TranslationRecord[] {
	if (postIds.length === 0) {
		return [];
	}

	return db
		.select({
			id: postTranslations.id,
			postId: postTranslations.postId,
			languageCode: postTranslations.languageCode,
			status: postTranslations.status,
			slug: postTranslations.slug,
			workingRevisionId: postTranslations.workingRevisionId,
			pendingRevisionId: postTranslations.pendingRevisionId,
			liveRevisionId: postTranslations.liveRevisionId,
			scheduledAt: postTranslations.scheduledAt,
			publishedAt: postTranslations.publishedAt,
			updatedAt: postTranslations.updatedAt
		})
		.from(postTranslations)
		.innerJoin(contentLanguages, eq(contentLanguages.code, postTranslations.languageCode))
		.where(inArray(postTranslations.postId, postIds))
		.orderBy(asc(contentLanguages.sortOrder), asc(contentLanguages.name))
		.all();
}

export function findTranslation(
	db: DatabaseExecutor,
	postId: string,
	languageCode: string
): TranslationRecord | null {
	return (
		listTranslations(db, [postId]).find(
			(translation) => translation.languageCode === languageCode
		) ?? null
	);
}

export function summarizeTranslations(
	db: DatabaseExecutor,
	translations: TranslationRecord[]
): TranslationSummary[] {
	const titles = workingTitles(db, translations);

	return translations.map((translation) => ({
		id: translation.id,
		languageCode: translation.languageCode,
		status: translation.status,
		title: titles.get(translation.id) ?? '',
		hasPendingChanges: translation.pendingRevisionId !== null
	}));
}

export function createPost(
	runtime: Runtime,
	actor: AuthUser,
	languageCode: string
): PostCreateResult {
	requirePermission(actor, 'post.create', null);

	if (!isEnabledLanguage(runtime.db, languageCode)) {
		return { status: 'unknown_language' };
	}

	const postId = crypto.randomUUID();

	runtime.db.transaction((tx) => {
		tx.insert(posts).values({ id: postId, ownerId: actor.id }).run();
		createTranslationRow(tx, postId, languageCode, actor.id);
	});

	return { status: 'created', postId, languageCode };
}

export function addTranslation(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	languageCode: string
): TranslationAddResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return { status: 'not_found' };
	}

	requirePermission(actor, 'post.edit', postSubject(post));

	if (!isEnabledLanguage(runtime.db, languageCode)) {
		return { status: 'unknown_language' };
	}

	if (findTranslation(runtime.db, postId, languageCode) !== null) {
		return { status: 'exists' };
	}

	runtime.db.transaction((tx) => {
		createTranslationRow(tx, postId, languageCode, actor.id);
		tx.update(posts).set({ updatedAt: new Date() }).where(eq(posts.id, postId)).run();
	});

	return { status: 'added', languageCode };
}

export function listPosts(
	db: AppDatabase,
	actor: AuthUser,
	includeOthers: boolean,
	requestedPage: number
): PostListPage {
	const filter = listFilter(actor, includeOthers);
	const total = db.select({ total: count() }).from(posts).where(filter).get()?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / POST_PAGE_SIZE));
	const page = Math.min(Math.max(1, requestedPage), pageCount);
	const rows = db
		.select({
			id: posts.id,
			ownerId: posts.ownerId,
			ownerName: user.name,
			coverMediaId: posts.coverMediaId,
			hiddenByModerator: posts.hiddenByModerator,
			updatedAt: posts.updatedAt
		})
		.from(posts)
		.innerJoin(user, eq(user.id, posts.ownerId))
		.where(filter)
		.orderBy(desc(posts.updatedAt), desc(posts.id))
		.limit(POST_PAGE_SIZE)
		.offset((page - 1) * POST_PAGE_SIZE)
		.all();
	const translations = listTranslations(
		db,
		rows.map((row) => row.id)
	);
	const summaries = new Map<string, TranslationSummary[]>();

	summarizeTranslations(db, translations).forEach((summary, index) => {
		const postId = translations[index].postId;
		const list = summaries.get(postId) ?? [];

		list.push(summary);
		summaries.set(postId, list);
	});

	const items: PostListItem[] = rows.map((row) => ({
		...row,
		own: row.ownerId === actor.id,
		translations: summaries.get(row.id) ?? []
	}));

	return { items, page, pageCount, total };
}

export function updatePostSettings(
	runtime: Runtime,
	actor: AuthUser,
	postId: string,
	input: PostSettingsInput
): PostSettingsResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return 'not_found';
	}

	requirePermission(actor, 'post.edit', postSubject(post));

	if (input.categoryId !== null && !categoryExists(runtime.db, input.categoryId)) {
		return 'unknown_category';
	}

	if (
		input.coverMediaId !== null &&
		input.coverMediaId !== post.coverMediaId &&
		unusableMediaIds(runtime.db, actor, [input.coverMediaId]).length > 0
	) {
		return 'invalid_media';
	}

	const changed =
		input.categoryId !== post.categoryId || input.coverMediaId !== post.coverMediaId;

	if (changed && !publishesDirectly(actor) && hasLiveTranslation(runtime.db, postId)) {
		return 'locked';
	}

	runtime.db
		.update(posts)
		.set({
			categoryId: input.categoryId,
			coverMediaId: input.coverMediaId,
			updatedAt: new Date()
		})
		.where(eq(posts.id, postId))
		.run();

	return 'saved';
}

export function postSettingsLocked(db: AppDatabase, actor: AuthUser, postId: string): boolean {
	return !publishesDirectly(actor) && hasLiveTranslation(db, postId);
}

export function deletePost(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	postId: string
): PostDeleteResult {
	const post = findPost(runtime.db, postId);

	if (post === null) {
		return 'not_found';
	}

	requirePermission(actor, 'post.delete', postSubject(post));

	const translations = listTranslations(runtime.db, [postId]);
	const titles = Object.fromEntries(
		summarizeTranslations(runtime.db, translations).map((summary) => [
			summary.languageCode,
			summary.title
		])
	);

	const announced = translations
		.filter((translation) => translation.slug !== null)
		.map((translation) => ({ languageCode: translation.languageCode, slug: translation.slug }));

	runtime.db.transaction((tx) => {
		if (announced.length > 0) {
			enqueuePostEvent(tx, 'post.deleted', { postId, translations: announced });
		}

		tx.update(postTranslations)
			.set({
				status: 'draft',
				slug: null,
				scheduledAt: null,
				workingRevisionId: null,
				pendingRevisionId: null,
				liveRevisionId: null
			})
			.where(eq(postTranslations.postId, postId))
			.run();
		tx.delete(posts).where(eq(posts.id, postId)).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'post.deleted',
			targetType: 'post',
			targetId: postId,
			details: { titles },
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return 'deleted';
}

export function canViewPost(actor: AuthUser, post: PostRecord): boolean {
	return can(actor, 'post.view', postSubject(post));
}

function listFilter(actor: AuthUser, includeOthers: boolean): SQL | undefined {
	requirePermission(actor, 'post.list', null);

	if (!includeOthers) {
		return eq(posts.ownerId, actor.id);
	}

	requirePermission(actor, 'post.list_all', null);

	return undefined;
}

function createTranslationRow(
	tx: DatabaseExecutor,
	postId: string,
	languageCode: string,
	authorId: string
): void {
	const rendered = renderContentDocument(emptyContentDocument());

	if (rendered.status !== 'rendered') {
		throw new Error('The empty content document could not be rendered');
	}

	const translationId = crypto.randomUUID();

	tx.insert(postTranslations).values({ id: translationId, postId, languageCode }).run();

	const revisionId = insertRevision(tx, translationId, languageCode, authorId, {
		title: '',
		slug: '',
		excerpt: '',
		metaTitle: null,
		metaDescription: null,
		ogMediaId: null,
		contentJson: rendered.content.json,
		contentHtml: rendered.content.html,
		contentText: rendered.content.text,
		readingTimeMinutes: rendered.content.readingTimeMinutes,
		tags: [],
		mediaIds: []
	});

	tx.update(postTranslations)
		.set({ workingRevisionId: revisionId })
		.where(eq(postTranslations.id, translationId))
		.run();
}

function workingTitles(
	db: DatabaseExecutor,
	translations: TranslationRecord[]
): Map<string, string> {
	const revisionIds = translations
		.map((translation) => translation.workingRevisionId ?? translation.liveRevisionId)
		.filter((id): id is string => id !== null);

	if (revisionIds.length === 0) {
		return new Map();
	}

	return new Map(
		db
			.select({ translationId: postRevisions.translationId, title: postRevisions.title })
			.from(postRevisions)
			.where(inArray(postRevisions.id, revisionIds))
			.all()
			.map((row) => [row.translationId, row.title])
	);
}

function isEnabledLanguage(db: DatabaseExecutor, languageCode: string): boolean {
	const row = db
		.select({ code: contentLanguages.code })
		.from(contentLanguages)
		.where(and(eq(contentLanguages.code, languageCode), eq(contentLanguages.enabled, true)))
		.get();

	return row !== undefined;
}

function categoryExists(db: DatabaseExecutor, categoryId: string): boolean {
	const row = db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.id, categoryId))
		.get();

	return row !== undefined;
}

function hasLiveTranslation(db: DatabaseExecutor, postId: string): boolean {
	const row = db
		.select({ id: postTranslations.id })
		.from(postTranslations)
		.where(and(eq(postTranslations.postId, postId), isNotNull(postTranslations.liveRevisionId)))
		.get();

	return row !== undefined;
}
