import type { ParamMatcher } from '@sveltejs/kit';
import { ARCHIVE_NAME_PATTERN } from '$lib/constants/backups';

export const match: ParamMatcher = (param) => ARCHIVE_NAME_PATTERN.test(param);
