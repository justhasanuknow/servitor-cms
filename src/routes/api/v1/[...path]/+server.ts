import { apiErrorResponse, notFoundError } from '$lib/server/api/api-errors';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => apiErrorResponse(notFoundError());
