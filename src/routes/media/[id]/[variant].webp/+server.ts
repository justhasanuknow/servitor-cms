import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { MEDIA_VARIANTS } from '$lib/constants/media';
import { MEDIA_ID_PATTERN } from '$lib/content/media-urls';
import { mediaExists } from '$lib/server/media/media-library';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const paramsSchema = z.object({
	id: z.string().regex(MEDIA_ID_PATTERN),
	variant: z.enum(MEDIA_VARIANTS)
});

export const GET: RequestHandler = async ({ params }) => {
	const parsed = paramsSchema.safeParse(params);

	if (!parsed.success) {
		error(404, { message: 'Not found' });
	}

	const runtime = getRuntime();

	if (!mediaExists(runtime.db, parsed.data.id)) {
		error(404, { message: 'Not found' });
	}

	const data = await runtime.media.read(parsed.data.id, parsed.data.variant);

	if (data === null) {
		error(404, { message: 'Not found' });
	}

	return new Response(new Uint8Array(data), {
		headers: {
			'Content-Type': 'image/webp',
			'Content-Length': String(data.byteLength),
			'Content-Disposition': `inline; filename="${parsed.data.id}-${parsed.data.variant}.webp"`,
			'Cache-Control': CACHE_CONTROL,
			'X-Content-Type-Options': 'nosniff',
			'Cross-Origin-Resource-Policy': 'cross-origin'
		}
	});
};
