import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	BIO_MAX_LENGTH,
	DISPLAY_NAME_MAX_LENGTH,
	THEME_MODES,
	THEME_PALETTES,
	UI_LOCALES,
	type UiLocale
} from '$lib/constants/preferences';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { requireAccountActor } from '$lib/server/auth/actor';
import { readFormFields } from '$lib/server/http/form';
import { writeLocaleCookie, writeThemeCookie } from '$lib/server/preferences/preference-cookies';
import { loadProfile, updateProfile } from '$lib/server/preferences/preferences';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const profileSchema = z.object({
	name: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
	bio: z.string().trim().max(BIO_MAX_LENGTH),
	uiLocale: z.union([z.literal(''), z.enum(UI_LOCALES)]),
	themePalette: z.enum(THEME_PALETTES),
	themeMode: z.enum(THEME_MODES)
});

export const load: PageServerLoad = ({ locals, url }) => {
	const { user } = requireAccountActor(locals);
	const profile = loadProfile(getRuntime().db, user.id);

	if (profile === null) {
		error(404, { message: 'Not found' });
	}

	return { profile, saved: url.searchParams.has('saved') };
};

export const actions: Actions = {
	default: async (event) => {
		const { user } = requireAccountActor(event.locals);
		const form = profileSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		let uiLocale: UiLocale | null = null;

		if (form.data.uiLocale !== '') {
			uiLocale = form.data.uiLocale;
		}

		let bio: string | null = null;

		if (form.data.bio !== '') {
			bio = form.data.bio;
		}

		const secure = event.url.protocol === 'https:';

		updateProfile(getRuntime().db, user.id, {
			name: form.data.name,
			bio,
			uiLocale,
			themePalette: form.data.themePalette,
			themeMode: form.data.themeMode
		});
		writeThemeCookie(
			event.cookies,
			{ palette: form.data.themePalette, mode: form.data.themeMode },
			secure
		);
		writeLocaleCookie(event.cookies, uiLocale, secure);
		redirect(303, `${PANEL_ROUTES.profile}?saved`);
	}
};
