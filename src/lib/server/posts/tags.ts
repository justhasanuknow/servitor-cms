import { createHash } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { MAX_TAGS_PER_TRANSLATION, TAG_NAME_MAX_LENGTH } from '../../constants/content';
import { slugFromText } from '../content/slugs';
import type { DatabaseExecutor } from '../db';
import { postRevisionTags, tags } from '../db/schema';
import type { TagParseResult } from './tags.interfaces';

const TAG_SEPARATORS = /[,،、，;]/u;

const HASH_SLUG_LENGTH = 12;

export function parseTagInput(input: string): TagParseResult {
	const names = new Map<string, string>();

	for (const part of input.split(TAG_SEPARATORS)) {
		const name = part.replace(/\s+/gu, ' ').trim();

		if (name === '') {
			continue;
		}

		if (name.length > TAG_NAME_MAX_LENGTH) {
			return { status: 'tag_too_long' };
		}

		const key = name.normalize('NFKC').toLocaleLowerCase();

		if (!names.has(key)) {
			names.set(key, name);
		}
	}

	if (names.size > MAX_TAGS_PER_TRANSLATION) {
		return { status: 'too_many_tags' };
	}

	return { status: 'ok', names: [...names.values()] };
}

export function tagSlug(name: string, languageCode: string): string {
	const slug = slugFromText(name, languageCode);

	if (slug !== '') {
		return slug;
	}

	return createHash('sha256')
		.update(name.normalize('NFKC').toLocaleLowerCase())
		.digest('hex')
		.slice(0, HASH_SLUG_LENGTH);
}

export function attachTags(
	tx: DatabaseExecutor,
	revisionId: string,
	languageCode: string,
	names: string[]
): void {
	tx.delete(postRevisionTags).where(eq(postRevisionTags.revisionId, revisionId)).run();

	const tagIds = new Set<string>();

	for (const name of names) {
		tagIds.add(ensureTag(tx, languageCode, name));
	}

	if (tagIds.size > 0) {
		tx.insert(postRevisionTags)
			.values([...tagIds].map((tagId) => ({ revisionId, tagId })))
			.run();
	}
}

export function tagNamesOf(db: DatabaseExecutor, revisionIds: string[]): Map<string, string[]> {
	const result = new Map<string, string[]>();

	if (revisionIds.length === 0) {
		return result;
	}

	const rows = db
		.select({ revisionId: postRevisionTags.revisionId, name: tags.name })
		.from(postRevisionTags)
		.innerJoin(tags, eq(tags.id, postRevisionTags.tagId))
		.where(inArray(postRevisionTags.revisionId, revisionIds))
		.orderBy(asc(tags.name))
		.all();

	for (const row of rows) {
		const names = result.get(row.revisionId) ?? [];

		names.push(row.name);
		result.set(row.revisionId, names);
	}

	return result;
}

function ensureTag(tx: DatabaseExecutor, languageCode: string, name: string): string {
	const slug = tagSlug(name, languageCode);
	const existing = tx
		.select({ id: tags.id })
		.from(tags)
		.where(and(eq(tags.languageCode, languageCode), eq(tags.slug, slug)))
		.get();

	if (existing !== undefined) {
		return existing.id;
	}

	const id = crypto.randomUUID();

	tx.insert(tags).values({ id, languageCode, name, slug }).run();

	return id;
}
