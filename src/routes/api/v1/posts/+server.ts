import { postsEndpoint } from '$lib/server/api/api-endpoints';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => postsEndpoint(getRuntime(), event);
