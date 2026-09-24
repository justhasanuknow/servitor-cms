import { error, redirect } from '@sveltejs/kit';
import { blogIndexPath } from '$lib/public/paths';
import { defaultLanguageCode } from '$lib/server/languages/languages';
import { requirePublicSite } from '$lib/server/public/public-site';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const { db } = getRuntime();

	requirePublicSite(db);

	const language = defaultLanguageCode(db);

	if (language === null) {
		error(404, { message: 'Not found' });
	}

	redirect(307, blogIndexPath(language));
};
