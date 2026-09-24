import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { USER_ROLES } from '../../constants/users';
import { createTestDatabase } from '../testing/database';
import type { AppDatabase } from './index';
import {
	auditLog,
	categories,
	contentLanguages,
	media,
	postRevisionMedia,
	postRevisions,
	postTranslations,
	posts,
	systemSettings,
	user
} from './schema';

let database: ReturnType<typeof createTestDatabase>;
let db: AppDatabase;

beforeEach(() => {
	database = createTestDatabase();
	db = database.db;
});

afterEach(() => {
	database.dispose();
});

function insertUser(role: (typeof USER_ROLES)[number] = 'author'): string {
	const id = crypto.randomUUID();

	db.insert(user)
		.values({ id, name: 'Test User', email: `${id}@example.com`, role })
		.run();

	return id;
}

function captureError(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}

	throw new Error('Expected the statement to fail');
}

function insertLanguage(code: string, isDefault: boolean): void {
	db.insert(contentLanguages).values({ code, name: code, nativeName: code, isDefault }).run();
}

function insertPost(ownerId: string, languageCode = 'en', categoryId: string | null = null) {
	const postId = crypto.randomUUID();
	const translationId = crypto.randomUUID();
	const revisionId = crypto.randomUUID();

	db.insert(posts).values({ id: postId, ownerId, categoryId }).run();
	db.insert(postTranslations).values({ id: translationId, postId, languageCode }).run();
	db.insert(postRevisions)
		.values({
			id: revisionId,
			translationId,
			authorId: ownerId,
			title: 'Hello',
			slug: 'hello',
			contentJson: '{}',
			contentHtml: '',
			contentText: '',
			readingTimeMinutes: 1
		})
		.run();

	return { postId, translationId, revisionId };
}

describe('database connection', () => {
	it('uses WAL journaling and enforces foreign keys', () => {
		const journal = db.get<{ journal_mode: string }>(sql`PRAGMA journal_mode`);
		const foreignKeys = db.get<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);

		expect(journal.journal_mode).toBe('wal');
		expect(foreignKeys.foreign_keys).toBe(1);
	});

	it('creates the system settings row with the documented defaults', () => {
		expect(db.select().from(systemSettings).all()).toMatchObject([
			{
				id: 1,
				siteName: 'Servitor CMS',
				publicSiteEnabled: true,
				requireTwoFactorForAdmins: false,
				defaultApiRateLimit: 120,
				revisionRetention: 50
			}
		]);
		expect(() => db.delete(systemSettings).run()).toThrow(/system settings cannot be deleted/);
	});
});

describe('users', () => {
	it('allows exactly one founder', () => {
		insertUser('founder');

		expect(() => insertUser('founder')).toThrow(/UNIQUE constraint failed/);
	});

	it('rejects unknown roles', () => {
		const id = crypto.randomUUID();
		const error = captureError(() =>
			db.run(
				sql`insert into "user" (id, name, email, role) values (${id}, ${'Owner'}, ${'owner@example.com'}, ${'owner'})`
			)
		);

		expect(error).toHaveProperty('cause.message', 'invalid user role');
	});

	it('keeps the founder role and the founder account active', () => {
		const founderId = insertUser('founder');
		const authorId = insertUser('author');

		expect(() =>
			db.update(user).set({ role: 'admin' }).where(eq(user.id, founderId)).run()
		).toThrow(/founder role cannot be changed/);
		expect(() =>
			db.update(user).set({ role: 'founder' }).where(eq(user.id, authorId)).run()
		).toThrow(/founder role cannot be changed/);
		expect(() =>
			db.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, founderId)).run()
		).toThrow(/founder cannot be deactivated/);
	});

	it('deactivates other users but never deletes anyone', () => {
		const authorId = insertUser('author');

		db.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, authorId)).run();

		expect(() => db.delete(user).where(eq(user.id, authorId)).run()).toThrow(
			/users cannot be deleted/
		);
	});
});

describe('content languages', () => {
	it('keeps a single enabled default language that cannot be deleted', () => {
		insertLanguage('en', true);

		expect(() => insertLanguage('tr', true)).toThrow(/UNIQUE constraint failed/);
		expect(() =>
			db
				.update(contentLanguages)
				.set({ enabled: false })
				.where(eq(contentLanguages.code, 'en'))
				.run()
		).toThrow(/CHECK constraint failed/);
		expect(() =>
			db.delete(contentLanguages).where(eq(contentLanguages.code, 'en')).run()
		).toThrow(/default content language cannot be deleted/);
	});

	it('deletes an unused language but not one that a translation uses', () => {
		insertLanguage('en', true);
		insertLanguage('tr', false);
		insertLanguage('de', false);
		insertPost(insertUser(), 'de');

		db.delete(contentLanguages).where(eq(contentLanguages.code, 'tr')).run();

		expect(() =>
			db.delete(contentLanguages).where(eq(contentLanguages.code, 'de')).run()
		).toThrow(/FOREIGN KEY constraint failed/);
		expect(db.select().from(contentLanguages).all()).toHaveLength(2);
	});
});

describe('posts', () => {
	it('blocks deleting a category that a post uses', () => {
		const categoryId = crypto.randomUUID();

		insertLanguage('en', true);
		db.insert(categories).values({ id: categoryId }).run();

		const { postId } = insertPost(insertUser(), 'en', categoryId);

		expect(() => db.delete(categories).where(eq(categories.id, categoryId)).run()).toThrow(
			/FOREIGN KEY constraint failed/
		);

		db.update(posts).set({ categoryId: null }).where(eq(posts.id, postId)).run();
		db.delete(categories).where(eq(categories.id, categoryId)).run();

		expect(db.select().from(categories).all()).toHaveLength(0);
	});

	it('blocks deleting media that a revision references', () => {
		const mediaId = crypto.randomUUID();

		insertLanguage('en', true);

		const ownerId = insertUser();

		db.insert(media)
			.values({
				id: mediaId,
				ownerId,
				sourceFormat: 'png',
				width: 10,
				height: 10,
				byteSize: 100
			})
			.run();

		const { revisionId } = insertPost(ownerId);

		db.insert(postRevisionMedia).values({ revisionId, mediaId }).run();

		expect(() => db.delete(media).where(eq(media.id, mediaId)).run()).toThrow(
			/FOREIGN KEY constraint failed/
		);
	});

	it('deletes translations and revisions together with the post', () => {
		insertLanguage('en', true);

		const { postId, translationId, revisionId } = insertPost(insertUser());

		db.update(postTranslations)
			.set({
				status: 'published',
				slug: 'hello',
				liveRevisionId: revisionId,
				workingRevisionId: revisionId,
				publishedAt: new Date()
			})
			.where(eq(postTranslations.id, translationId))
			.run();
		db.delete(posts).where(eq(posts.id, postId)).run();

		expect(db.select().from(postTranslations).all()).toHaveLength(0);
		expect(db.select().from(postRevisions).all()).toHaveLength(0);
	});

	it('requires a live revision before a translation is published', () => {
		insertLanguage('en', true);

		const { translationId } = insertPost(insertUser());

		expect(() =>
			db
				.update(postTranslations)
				.set({ status: 'published', slug: 'hello' })
				.where(eq(postTranslations.id, translationId))
				.run()
		).toThrow(/CHECK constraint failed/);
	});

	it('requires a note when a revision is rejected', () => {
		insertLanguage('en', true);

		const { revisionId } = insertPost(insertUser());

		expect(() =>
			db
				.update(postRevisions)
				.set({ reviewState: 'rejected' })
				.where(eq(postRevisions.id, revisionId))
				.run()
		).toThrow(/CHECK constraint failed/);
	});

	it('requires complete moderation details when hiding a post', () => {
		insertLanguage('en', true);

		const moderatorId = insertUser('admin');
		const { postId } = insertPost(insertUser());

		expect(() =>
			db.update(posts).set({ hiddenByModerator: true }).where(eq(posts.id, postId)).run()
		).toThrow(/CHECK constraint failed/);

		db.update(posts)
			.set({
				hiddenByModerator: true,
				hiddenBy: moderatorId,
				hiddenReason: 'Spam',
				hiddenAt: new Date()
			})
			.where(eq(posts.id, postId))
			.run();

		expect(db.select().from(posts).get()).toMatchObject({
			hiddenByModerator: true,
			hiddenReason: 'Spam'
		});
	});
});

describe('audit log', () => {
	it('is append-only', () => {
		const actorId = insertUser('founder');

		db.insert(auditLog)
			.values({ actorType: 'user', actorId, action: 'settings.updated' })
			.run();

		expect(() => db.update(auditLog).set({ action: 'changed' }).run()).toThrow(/append-only/);
		expect(() => db.delete(auditLog).run()).toThrow(/append-only/);
	});

	it('requires an actor id exactly for user actions', () => {
		expect(() => db.insert(auditLog).values({ actorType: 'user', action: 'x' }).run()).toThrow(
			/CHECK constraint failed/
		);

		db.insert(auditLog).values({ actorType: 'cli', action: 'founder.reset' }).run();

		expect(db.select().from(auditLog).all()).toHaveLength(1);
	});
});
