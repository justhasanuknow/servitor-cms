import { json } from '@sveltejs/kit';
import { requireActor } from '$lib/server/auth/actor';
import { requireBackupAccess } from '$lib/server/backups/backup-access';
import { appendUpload, cancelUpload, UPLOAD_CHUNK_BYTES } from '$lib/server/backups/backup-uploads';
import { requireSameOrigin } from '$lib/server/http/same-origin';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, request, url }) => {
	const { user } = requireActor(locals);
	const runtime = getRuntime();

	requireSameOrigin(request, runtime.env.ORIGIN);

	const offset = Number(url.searchParams.get('offset'));
	const declared = Number(request.headers.get('content-length'));

	if (!Number.isSafeInteger(offset) || offset < 0 || declared > UPLOAD_CHUNK_BYTES) {
		return json({ status: 'out_of_order' }, { status: 400 });
	}

	const chunk = new Uint8Array(await request.arrayBuffer());
	const result = await appendUpload(runtime, user, params.id, offset, chunk);

	if (result.status === 'received') {
		return json(result);
	}

	if (result.status === 'not_found') {
		return json(result, { status: 404 });
	}

	if (result.status === 'two_factor_required') {
		return json(result, { status: 403 });
	}

	return json(result, { status: 409 });
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const { user } = requireActor(locals);

	requireSameOrigin(request, getRuntime().env.ORIGIN);
	requireBackupAccess(user);

	if (await cancelUpload(user, params.id)) {
		return new Response(null, { status: 204 });
	}

	return json({ status: 'not_found' }, { status: 404 });
};
