import { error, fail, redirect } from '@sveltejs/kit';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import { requireBackupAccess } from '$lib/server/backups/backup-access';
import { deleteBackupArchive, findArchive, requestPanelRestore } from '$lib/server/backups/backups';
import { readFormFields } from '$lib/server/http/form';
import { scheduleRestart } from '$lib/server/operations/restart';
import { getRuntime } from '$lib/server/runtime';
import { m } from '$lib/paraglide/messages';
import type { Actions, PageServerLoad } from './$types';

const DOWNLOAD_ERRORS = new Set([
	'not_found',
	'two_factor_required',
	'passphrase_mismatch',
	'passphrase_too_short',
	'passphrase_too_long',
	'invalid_password',
	'missing_code',
	'invalid_code',
	'rate_limited',
	'invalid_input'
]);

const RESTORE_KEYWORD = 'RESTORE';

const confirmationSchema = z.object({
	password: passwordField,
	totpCode: optionalCodeField
});

const restoreSchema = confirmationSchema.extend({
	confirmWord: z.string().max(100).default('')
});

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { user } = requireActor(locals);

	if (!requireBackupAccess(user)) {
		redirect(303, PANEL_ROUTES.backups);
	}

	const archive = await findArchive(getRuntime(), user, params.name);

	if (archive === null) {
		error(404, { message: 'Not found' });
	}

	return { archive, downloadError: knownDownloadError(url.searchParams.get('download_error')) };
};

function knownDownloadError(value: string | null): string | null {
	if (value === null || !DOWNLOAD_ERRORS.has(value)) {
		return null;
	}

	return value;
}

function confirmsRestore(typed: string): boolean {
	const word = typed.trim();

	return word === m.backups_restore_word() || word === RESTORE_KEYWORD;
}

export const actions: Actions = {
	restore: async (event) => {
		const { user } = requireActor(event.locals);
		const form = restoreSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const runtime = getRuntime();
		const result = await requestPanelRestore(
			runtime,
			createAuthRequest(event),
			user,
			event.params.name,
			{ password: form.data.password, totpCode: form.data.totpCode },
			confirmsRestore(form.data.confirmWord)
		);

		if (result.status === 'scheduled') {
			scheduleRestart(runtime.logger);

			return { restoring: true as const };
		}

		if (result.status === 'invalid_archive') {
			return fail(400, { error: result.status, problem: result.problem });
		}

		return fail(400, { error: result.status });
	},
	delete: async (event) => {
		const { user } = requireActor(event.locals);
		const form = confirmationSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const result = await deleteBackupArchive(
			getRuntime(),
			createAuthRequest(event),
			user,
			event.params.name,
			form.data
		);

		if (result === 'deleted') {
			redirect(303, `${PANEL_ROUTES.backups}?deleted=1`);
		}

		return fail(400, { error: result });
	}
};
