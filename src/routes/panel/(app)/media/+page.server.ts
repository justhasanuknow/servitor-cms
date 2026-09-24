import { fail } from '@sveltejs/kit';
import { requireActor } from '$lib/server/auth/actor';
import { readFormFields } from '$lib/server/http/form';
import { defaultLanguageCode, listEnabledLanguages } from '$lib/server/languages/languages';
import { readAltTexts, readMediaId, readPageNumber } from '$lib/server/media/media-form';
import {
	deleteMedia,
	listOwnMedia,
	updateMediaAltTexts,
	uploadMedia
} from '$lib/server/media/media-library';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

function libraryUser(event: Pick<RequestEvent, 'locals'>) {
	const { user } = requireActor(event.locals);

	requirePermission(user, 'media.upload', null);

	return user;
}

export const load: PageServerLoad = (event) => {
	const user = libraryUser(event);
	const { db } = getRuntime();

	return {
		library: listOwnMedia(db, user.id, readPageNumber(event.url.searchParams.get('page'))),
		languages: listEnabledLanguages(db),
		defaultLanguage: defaultLanguageCode(db)
	};
};

export const actions: Actions = {
	upload: async (event) => {
		const user = libraryUser(event);
		const file = (await event.request.formData()).get('file');

		if (!(file instanceof File)) {
			return fail(400, { error: 'empty' as const, id: null });
		}

		const result = await uploadMedia(getRuntime(), user, file, 'library');

		if (result.status !== 'uploaded') {
			return fail(400, { error: result.status, id: null });
		}

		return { uploaded: result.id };
	},
	altTexts: async (event) => {
		const user = libraryUser(event);
		const runtime = getRuntime();
		const fields = await readFormFields(event.request);
		const id = readMediaId(fields.id);
		const entries = readAltTexts(fields, listEnabledLanguages(runtime.db));

		if (id === null || entries === null) {
			return fail(400, { error: 'invalid_input' as const, id });
		}

		const result = updateMediaAltTexts(runtime, user, id, entries);

		if (result !== 'saved') {
			return fail(400, { error: result, id });
		}

		return { saved: id };
	},
	delete: async (event) => {
		const user = libraryUser(event);
		const id = readMediaId((await readFormFields(event.request)).id);

		if (id === null) {
			return fail(400, { error: 'invalid_input' as const, id });
		}

		const result = await deleteMedia(getRuntime(), user, id);

		if (result !== 'deleted') {
			return fail(400, { error: result, id });
		}

		return { deleted: id };
	}
};
