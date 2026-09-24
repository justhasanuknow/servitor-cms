import { redirect } from '@sveltejs/kit';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { blogIndexPath } from '$lib/public/paths';
import { defaultLanguageCode } from '$lib/server/languages/languages';
import { getRuntime } from '$lib/server/runtime';
import { loadSystemSettings } from '$lib/server/settings/system-settings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const { db } = getRuntime();
	const language = defaultLanguageCode(db);

	if (!loadSystemSettings(db).publicSiteEnabled || language === null) {
		redirect(307, PANEL_ROUTES.root);
	}

	redirect(307, blogIndexPath(language));
};
