import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth';
import { getRuntime } from '../runtime';
import { restoreRevision } from './revisions';

const revisionIdSchema = z.uuid();

export function readRevisionId(value: string | undefined): string | null {
	const parsed = revisionIdSchema.safeParse(value);

	if (!parsed.success) {
		return null;
	}

	return parsed.data;
}

export function revisionIdParam(value: string): string {
	const parsed = readRevisionId(value);

	if (parsed === null) {
		error(404, { message: 'Not found' });
	}

	return parsed;
}

export function restoreAndReturn(
	user: AuthUser,
	postId: string,
	languageCode: string,
	revisionId: string | null,
	editorPath: string
) {
	if (revisionId === null) {
		return fail(400, { error: 'invalid_input' as const });
	}

	const result = restoreRevision(getRuntime(), user, postId, languageCode, revisionId);

	if (result === 'not_found') {
		error(404, { message: 'Not found' });
	}

	if (result !== 'restored') {
		return fail(400, { error: result });
	}

	redirect(303, `${editorPath}?restored`);
}
