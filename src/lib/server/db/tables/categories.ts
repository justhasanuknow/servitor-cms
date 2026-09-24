import { primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, updatedAt, uuidPrimaryKey } from './columns';
import { contentLanguages } from './languages';

export const categories = sqliteTable('categories', {
	id: uuidPrimaryKey(),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const categoryTranslations = sqliteTable(
	'category_translations',
	{
		categoryId: text('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' }),
		languageCode: text('language_code')
			.notNull()
			.references(() => contentLanguages.code, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		updatedAt: updatedAt()
	},
	(table) => [
		primaryKey({ columns: [table.categoryId, table.languageCode] }),
		uniqueIndex('category_translations_language_slug').on(table.languageCode, table.slug)
	]
);
