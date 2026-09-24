import { and, eq, inArray, isNotNull, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../db';
import { contentLanguages, postTranslations, posts } from '../db/schema';

function visibilityRule(): SQL {
	const rule = and(
		eq(posts.hiddenByModerator, false),
		eq(postTranslations.status, 'published'),
		isNotNull(postTranslations.liveRevisionId),
		eq(contentLanguages.enabled, true)
	);

	if (rule === undefined) {
		throw new Error('The public visibility rule is empty');
	}

	return rule;
}

export function publiclyVisible(db: DatabaseExecutor): SQL {
	const visible = db
		.select({ id: postTranslations.id })
		.from(postTranslations)
		.innerJoin(posts, eq(posts.id, postTranslations.postId))
		.innerJoin(contentLanguages, eq(contentLanguages.code, postTranslations.languageCode))
		.where(visibilityRule());

	return inArray(postTranslations.id, visible);
}
