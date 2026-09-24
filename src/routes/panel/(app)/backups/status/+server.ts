import { json } from '@sveltejs/kit';
import { requireActor } from '$lib/server/auth/actor';
import { requireBackupAccess } from '$lib/server/backups/backup-access';
import { backupJobs } from '$lib/server/backups/backup-jobs';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	const { user } = requireActor(locals);

	requireBackupAccess(user);

	const { current } = backupJobs(getRuntime()).state();

	return json({ running: current !== null }, { headers: { 'cache-control': 'no-store' } });
};
