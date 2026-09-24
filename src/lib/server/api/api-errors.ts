export class ApiError extends Error {
	readonly status: number;

	readonly code: string;

	readonly headers: Record<string, string>;

	constructor(
		status: number,
		code: string,
		message: string,
		headers: Record<string, string> = {}
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.headers = headers;
	}
}

export function apiErrorResponse(error: ApiError, headers: Headers = new Headers()): Response {
	for (const [name, value] of Object.entries(error.headers)) {
		headers.set(name, value);
	}

	headers.set('Content-Type', 'application/json; charset=utf-8');
	headers.set('Cache-Control', 'no-store');

	return new Response(JSON.stringify({ error: { code: error.code, message: error.message } }), {
		status: error.status,
		headers
	});
}

export function notFoundError(): ApiError {
	return new ApiError(404, 'not_found', 'The requested resource does not exist.');
}
