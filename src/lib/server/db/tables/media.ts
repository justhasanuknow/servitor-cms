import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { MEDIA_KINDS, MEDIA_SOURCE_FORMATS } from '../../../constants/media';
import { user } from '../auth.schema';
import { createdAt, flag, updatedAt, uuidPrimaryKey } from './columns';
import { contentLanguages } from './languages';

export const media = sqliteTable(
	'media',
	{
		id: uuidPrimaryKey(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id),
		kind: text('kind', { enum: MEDIA_KINDS }).notNull().default('library'),
		sourceFormat: text('source_format', { enum: MEDIA_SOURCE_FORMATS }).notNull(),
		animated: flag('animated').notNull().default(false),
		width: integer('width').notNull(),
		height: integer('height').notNull(),
		byteSize: integer('byte_size').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		index('media_owner').on(table.ownerId, table.createdAt),
		check('media_kind', sql`kind in ('library', 'avatar')`),
		check('media_source_format', sql`source_format in ('jpeg', 'png', 'webp', 'gif', 'avif')`),
		check('media_dimensions', sql`width > 0 and height > 0 and byte_size > 0`)
	]
);

export const mediaAltTexts = sqliteTable(
	'media_alt_texts',
	{
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		languageCode: text('language_code')
			.notNull()
			.references(() => contentLanguages.code, { onDelete: 'cascade' }),
		altText: text('alt_text').notNull(),
		updatedAt: updatedAt()
	},
	(table) => [primaryKey({ columns: [table.mediaId, table.languageCode] })]
);
