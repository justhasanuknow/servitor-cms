import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { defaultLanguageCode } from '$lib/server/languages/languages';
import { languageParam, postIdParam } from '$lib/server/posts/post-form';
import { loadPostPreview } from '$lib/server/public/preview';
import { findPublicLanguage } from '$lib/server/public/public-posts';
import { postSeo } from '$lib/server/public/seo';
import { getRuntime } from '$lib/server/runtime';
import { loadSystemSettings } from '$lib/server/settings/system-settings';
import type { PageServerLoad } from './$types';

const revisionSchema = z.uuid().nullable();

export const csr = false;

export const load: PageServerLoad = ({ locals, params, url }) => {
	const { user } = requireActor(locals);
	const postId = postIdParam(params.id);
	const languageCode = languageParam(params.language);
	const revision = revisionSchema.safeParse(url.searchParams.get('revision'));

	if (!revision.success) {
		error(404, { message: 'Not found' });
	}

	const { db, env } = getRuntime();
	const post = loadPostPreview(db, user, postId, languageCode, revision.data);

	if (post === null) {
		error(404, { message: 'Not found' });
	}

	const siteName = loadSystemSettings(db).siteName;
	const languageName = findPublicLanguage(db, languageCode)?.nativeName ?? languageCode;

	return {
		post,
		siteName,
		seo: postSeo({
			origin: env.ORIGIN,
			siteName,
			defaultLanguage: defaultLanguageCode(db),
			post,
			feedTitle: `${siteName} · ${languageName}`,
			robots: 'noindex, nofollow'
		})
	};
};
