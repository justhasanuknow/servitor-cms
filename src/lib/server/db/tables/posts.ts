import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { REVISION_REVIEW_STATES, TRANSLATION_STATUSES } from '../../../constants/content';
import { user } from '../auth.schema';
import { categories } from './categories';
import { createdAt, flag, timestamp, updatedAt, uuidPrimaryKey } from './columns';
import { contentLanguages } from './languages';
import { media } from './media';

export const posts = sqliteTable(
	'posts',
	{
		id: uuidPrimaryKey(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id),
		categoryId: text('category_id').references(() => categories.id),
		coverMediaId: text('cover_media_id').references(() => media.id),
		hiddenByModerator: flag('hidden_by_moderator').notNull().default(false),
		hiddenBy: text('hidden_by').references(() => user.id),
		hiddenReason: text('hidden_reason'),
		hiddenAt: timestamp('hidden_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('posts_owner').on(table.ownerId),
		index('posts_category').on(table.categoryId),
		index('posts_cover_media').on(table.coverMediaId),
		check(
			'posts_moderation',
			sql`(hidden_by_moderator = 0 and hidden_by is null and hidden_reason is null and hidden_at is null) or (hidden_by_moderator = 1 and hidden_by is not null and hidden_reason is not null and hidden_at is not null)`
		)
	]
);

export const postTranslations = sqliteTable(
	'post_translations',
	{
		id: uuidPrimaryKey(),
		postId: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		languageCode: text('language_code')
			.notNull()
			.references(() => contentLanguages.code),
		slug: text('slug'),
		status: text('status', { enum: TRANSLATION_STATUSES }).notNull().default('draft'),
		scheduledAt: timestamp('scheduled_at'),
		publishedAt: timestamp('published_at'),
		workingRevisionId: text('working_revision_id').references(
			(): AnySQLiteColumn => postRevisions.id
		),
		pendingRevisionId: text('pending_revision_id').references(
			(): AnySQLiteColumn => postRevisions.id
		),
		liveRevisionId: text('live_revision_id').references(
			(): AnySQLiteColumn => postRevisions.id
		),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('post_translations_post_language').on(table.postId, table.languageCode),
		uniqueIndex('post_translations_language_slug').on(table.languageCode, table.slug),
		index('post_translations_schedule').on(table.status, table.scheduledAt),
		index('post_translations_listing').on(table.languageCode, table.status, table.publishedAt),
		check(
			'post_translations_status',
			sql`status in ('draft', 'pending_review', 'scheduled', 'published', 'unpublished')`
		),
		check(
			'post_translations_live_revision',
			sql`status in ('draft', 'pending_review') or live_revision_id is not null`
		),
		check('post_translations_live_slug', sql`live_revision_id is null or slug is not null`),
		check(
			'post_translations_scheduled_at',
			sql`status <> 'scheduled' or scheduled_at is not null`
		)
	]
);

export const postRevisions = sqliteTable(
	'post_revisions',
	{
		id: uuidPrimaryKey(),
		translationId: text('translation_id')
			.notNull()
			.references((): AnySQLiteColumn => postTranslations.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id),
		title: text('title').notNull(),
		slug: text('slug').notNull(),
		excerpt: text('excerpt').notNull().default(''),
		metaTitle: text('meta_title'),
		metaDescription: text('meta_description'),
		ogMediaId: text('og_media_id').references(() => media.id),
		contentJson: text('content_json').notNull(),
		contentHtml: text('content_html').notNull(),
		contentText: text('content_text').notNull(),
		readingTimeMinutes: integer('reading_time_minutes').notNull(),
		reviewState: text('review_state', { enum: REVISION_REVIEW_STATES })
			.notNull()
			.default('none'),
		reviewNote: text('review_note'),
		reviewedBy: text('reviewed_by').references(() => user.id),
		reviewedAt: timestamp('reviewed_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('post_revisions_translation').on(table.translationId, table.createdAt),
		index('post_revisions_og_media').on(table.ogMediaId),
		check(
			'post_revisions_review_state',
			sql`review_state in ('none', 'pending', 'approved', 'rejected')`
		),
		check(
			'post_revisions_rejection_note',
			sql`review_state <> 'rejected' or review_note is not null`
		),
		check('post_revisions_reading_time', sql`reading_time_minutes >= 0`)
	]
);

export const tags = sqliteTable(
	'tags',
	{
		id: uuidPrimaryKey(),
		languageCode: text('language_code')
			.notNull()
			.references(() => contentLanguages.code, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		createdAt: createdAt()
	},
	(table) => [uniqueIndex('tags_language_slug').on(table.languageCode, table.slug)]
);

export const postRevisionTags = sqliteTable(
	'post_revision_tags',
	{
		revisionId: text('revision_id')
			.notNull()
			.references(() => postRevisions.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tags.id)
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.tagId] }),
		index('post_revision_tags_tag').on(table.tagId)
	]
);

export const postRevisionMedia = sqliteTable(
	'post_revision_media',
	{
		revisionId: text('revision_id')
			.notNull()
			.references(() => postRevisions.id, { onDelete: 'cascade' }),
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id)
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.mediaId] }),
		index('post_revision_media_media').on(table.mediaId)
	]
);
