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
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { emailField, optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import { getLocale } from '$lib/paraglide/runtime';
import { requestEmailChange } from '$lib/server/users/email-change';
import { readFormFields } from '$lib/server/http/form';
import { avatarMediaId, removeAvatar, replaceAvatar } from '$lib/server/media/avatars';
import { findMedia } from '$lib/server/media/media-library';
import { writeLocaleCookie, writeThemeCookie } from '$lib/server/preferences/preference-cookies';
import { loadProfile, updateProfile } from '$lib/server/preferences/preferences';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const emailChangeSchema = z.object({
	email: emailField,
	password: passwordField,
	totpCode: optionalCodeField
});

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

	return {
		profile,
		avatar: avatarOf(user.id),
		saved: url.searchParams.has('saved'),
		email: user.email,
		emailVerification: getRuntime().mailer.enabled,
		actorTwoFactorEnabled: user.twoFactorEnabled === true
	};
};

export const actions: Actions = {
	save: async (event) => {
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
	},
	avatar: async (event) => {
		const { user } = requireAccountActor(event.locals);
		const file = (await event.request.formData()).get('avatar');

		if (!(file instanceof File)) {
			return fail(400, { avatarError: 'empty' as const });
		}

		const result = await replaceAvatar(getRuntime(), user, file);

		if (result.status !== 'uploaded') {
			return fail(400, { avatarError: result.status });
		}

		return { avatarSaved: true };
	},
	changeEmail: async (event) => {
		const { user } = requireAccountActor(event.locals);
		const form = emailChangeSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { emailError: 'invalid_input' as const });
		}

		const result = await requestEmailChange(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.data.email,
			{ password: form.data.password, totpCode: form.data.totpCode },
			getLocale()
		);

		if (result === 'changed' || result === 'verification_sent') {
			return { emailChange: { result, email: form.data.email } };
		}

		return fail(400, { emailError: result });
	},
	removeAvatar: async (event) => {
		const { user } = requireAccountActor(event.locals);

		await removeAvatar(getRuntime(), user);

		return { avatarSaved: true };
	}
};

function avatarOf(userId: string) {
	const { db } = getRuntime();
	const id = avatarMediaId(db, userId);

	if (id === null) {
		return null;
	}

	const record = findMedia(db, id);

	if (record === null) {
		return null;
	}

	return { id: record.id, width: record.width, height: record.height };
}
