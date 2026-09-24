import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActor } from '$lib/server/auth/actor';
import { startUpload } from '$lib/server/backups/backup-uploads';
import { requireSameOrigin } from '$lib/server/http/same-origin';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

const startSchema = z.object({ size: z.number().int().positive() });

export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = requireActor(locals);
	const runtime = getRuntime();

	requireSameOrigin(request, runtime.env.ORIGIN);

	const input = startSchema.safeParse(await request.json().catch(() => null));

	if (!input.success) {
		return json({ status: 'invalid_size' }, { status: 400 });
	}

	const result = await startUpload(runtime, user, input.data.size);

	return json(result, { status: statusCode(result.status) });
};

function statusCode(status: string): number {
	switch (status) {
		case 'started':
			return 201;
		case 'two_factor_required':
			return 403;
		case 'rate_limited':
			return 429;
		case 'insufficient_space':
			return 507;
		default:
			return 400;
	}
}
