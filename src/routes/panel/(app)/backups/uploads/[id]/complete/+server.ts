import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { completeUpload } from '$lib/server/backups/backup-uploads';
import { requireSameOrigin } from '$lib/server/http/same-origin';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

const completeSchema = z.object({ passphrase: z.string().max(2048).nullable().default(null) });

export const POST: RequestHandler = async (event) => {
	const { user } = requireActor(event.locals);
	const runtime = getRuntime();

	requireSameOrigin(event.request, runtime.env.ORIGIN);

	const input = completeSchema.safeParse(await event.request.json().catch(() => ({})));
	let passphrase: string | null = null;

	if (input.success && input.data.passphrase !== '') {
		passphrase = input.data.passphrase;
	}

	const result = await completeUpload(
		runtime,
		createAuthRequest(event),
		user,
		event.params.id,
		passphrase
	);

	if (result.status === 'uploaded') {
		return json(result);
	}

	if (result.status === 'not_found') {
		return json(result, { status: 404 });
	}

	if (result.status === 'two_factor_required') {
		return json(result, { status: 403 });
	}

	return json(result, { status: 422 });
};
