import { SITEMAP_PATH } from '$lib/constants/public';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { absoluteUrl } from '$lib/public/paths';
import { getRuntime } from '$lib/server/runtime';
import { loadSystemSettings } from '$lib/server/settings/system-settings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const { db, env } = getRuntime();
	let lines = ['User-agent: *', 'Disallow: /'];

	if (loadSystemSettings(db).publicSiteEnabled) {
		lines = [
			'User-agent: *',
			`Disallow: ${PANEL_ROUTES.root}/`,
			'',
			`Sitemap: ${absoluteUrl(env.ORIGIN, SITEMAP_PATH)}`
		];
	}

	return new Response(`${lines.join('\n')}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
};
