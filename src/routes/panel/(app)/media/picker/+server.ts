import { json } from '@sveltejs/kit';
import type { MediaPickerPage } from '$lib/modules/interfaces/media.interfaces';
import { requireActor } from '$lib/server/auth/actor';
import { defaultLanguageCode } from '$lib/server/languages/languages';
import { altTextFor, readPageNumber } from '$lib/server/media/media-form';
import { listOwnMedia } from '$lib/server/media/media-library';
import { requirePermission } from '$lib/server/permissions/permissions';
import { readLanguageCode } from '$lib/server/posts/post-form';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, url }) => {
	const { user } = requireActor(locals);

	requirePermission(user, 'media.upload', null);

	const { db } = getRuntime();
	const defaultLanguage = defaultLanguageCode(db);
	const languageCode = readLanguageCode(url.searchParams.get('language') ?? undefined) ?? '';
	const library = listOwnMedia(db, user.id, readPageNumber(url.searchParams.get('page')));
	const body: MediaPickerPage = {
		items: library.items.map((item) => ({
			id: item.id,
			width: item.width,
			height: item.height,
			alt: altTextFor(item, languageCode, defaultLanguage)
		})),
		page: library.page,
		pageCount: library.pageCount
	};

	return json(body, { headers: { 'Cache-Control': 'no-store' } });
};
