import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { UI_LOCALES } from '$lib/constants/preferences';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { readFormFields } from '$lib/server/http/form';
import { sameOriginPath } from '$lib/server/http/redirect-target';
import { can } from '$lib/server/permissions/permissions';
import { writeLocaleCookie } from '$lib/server/preferences/preference-cookies';
import { setUiLocale } from '$lib/server/preferences/preferences';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

const localeSchema = z.object({
	locale: z.enum(UI_LOCALES),
	redirectTo: z.string().max(2048).optional()
});

export const POST: RequestHandler = async (event) => {
	const form = localeSchema.safeParse(await readFormFields(event.request));

	if (!form.success) {
		error(400, { message: 'Invalid language' });
	}

	const user = event.locals.user;

	if (user !== null && can(user, 'account.manage', null)) {
		setUiLocale(getRuntime().db, user.id, form.data.locale);
	}

	writeLocaleCookie(event.cookies, form.data.locale, event.url.protocol === 'https:');
	redirect(303, sameOriginPath(form.data.redirectTo, event.url, PANEL_ROUTES.login));
};
