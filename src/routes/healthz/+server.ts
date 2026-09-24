import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

export const GET: RequestHandler = () => {
	const { db, logger } = getRuntime();

	try {
		db.get(sql`select 1`);
	} catch (error) {
		logger.error({ err: error }, 'Health check could not reach the database');

		return json({ status: 'error' }, { status: 503, headers: NO_STORE });
	}

	return json({ status: 'ok' }, { headers: NO_STORE });
};
