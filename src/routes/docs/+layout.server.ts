import { error } from '@sveltejs/kit';
import { canReadDocs, docsSections } from '$lib/server/docs/docs';
import { getRuntime } from '$lib/server/runtime';
import { loadSystemSettings } from '$lib/server/settings/system-settings';
import type { LayoutServerLoad } from './$types';

export const csr = false;

export const load: LayoutServerLoad = ({ locals, setHeaders }) => {
	const signedIn = locals.user !== null;

	if (!canReadDocs(loadSystemSettings(getRuntime().db).publicSiteEnabled, signedIn)) {
		error(404, { message: 'Not found' });
	}

	setHeaders({ 'cache-control': 'private, no-cache' });

	return { sections: docsSections(), signedIn };
};
