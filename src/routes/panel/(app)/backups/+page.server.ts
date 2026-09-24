import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import {
	BACKUP_HOUR_RANGE,
	BACKUP_RETENTION_RANGE,
	updateBackupSchedule
} from '$lib/server/backups/backup-schedule';
import { UPLOAD_CHUNK_BYTES } from '$lib/server/backups/backup-uploads';
import { backupsOverview, startManualBackup } from '$lib/server/backups/backups';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const scheduleSchema = z.object({
	frequency: z.enum(['off', 'daily', 'weekly']),
	hour: z.coerce.number().int().min(BACKUP_HOUR_RANGE.min).max(BACKUP_HOUR_RANGE.max),
	retention: z.coerce
		.number()
		.int()
		.min(BACKUP_RETENTION_RANGE.min)
		.max(BACKUP_RETENTION_RANGE.max),
	password: passwordField,
	totpCode: optionalCodeField
});

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = requireActor(locals);

	return {
		overview: await backupsOverview(getRuntime(), user),
		deleted: url.searchParams.get('deleted') === '1',
		limits: {
			hour: BACKUP_HOUR_RANGE,
			retention: BACKUP_RETENTION_RANGE,
			chunkBytes: UPLOAD_CHUNK_BYTES
		}
	};
};

export const actions: Actions = {
	create: ({ locals }) => {
		const { user } = requireActor(locals);
		const result = startManualBackup(getRuntime(), user);

		if (result === 'started') {
			return { created: true as const };
		}

		return fail(409, { error: result });
	},
	schedule: async (event) => {
		const { user } = requireActor(event.locals);
		const form = scheduleSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { error: 'invalid_input' as const });
		}

		const { password, totpCode, ...values } = form.data;
		const result = await updateBackupSchedule(
			getRuntime(),
			createAuthRequest(event),
			user,
			values,
			{ password, totpCode }
		);

		if (result === 'updated' || result === 'unchanged') {
			return { schedule: result };
		}

		return fail(400, { error: result });
	}
};
