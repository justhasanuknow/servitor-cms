import { createHash } from 'node:crypto';

const MILLISECONDS_PER_SECOND = 1000;

function entityTag(body: string): string {
	return `"${createHash('sha256').update(body).digest('base64url')}"`;
}

function matchesEntityTag(header: string, tag: string): boolean {
	return header
		.split(',')
		.map((candidate) => candidate.trim().replace(/^W\//, ''))
		.some((candidate) => candidate === '*' || candidate === tag);
}

function notModifiedSince(header: string, lastModified: Date): boolean {
	const since = Date.parse(header);

	if (Number.isNaN(since)) {
		return false;
	}

	return (
		Math.floor(lastModified.getTime() / MILLISECONDS_PER_SECOND) <=
		Math.floor(since / MILLISECONDS_PER_SECOND)
	);
}

function isNotModified(request: Request, tag: string, lastModified: Date | null): boolean {
	const ifNoneMatch = request.headers.get('if-none-match');

	if (ifNoneMatch !== null) {
		return matchesEntityTag(ifNoneMatch, tag);
	}

	const ifModifiedSince = request.headers.get('if-modified-since');

	if (ifModifiedSince !== null && lastModified !== null) {
		return notModifiedSince(ifModifiedSince, lastModified);
	}

	return false;
}

export function apiJson(
	request: Request,
	body: unknown,
	lastModified: Date | null,
	headers: Headers
): Response {
	const text = JSON.stringify(body);
	const tag = entityTag(text);

	headers.set('ETag', tag);
	headers.set('Cache-Control', 'private, no-cache');
	headers.set('Vary', appendVary(headers.get('Vary'), 'Authorization'));

	if (lastModified !== null) {
		headers.set('Last-Modified', lastModified.toUTCString());
	}

	if (isNotModified(request, tag, lastModified)) {
		return new Response(null, { status: 304, headers });
	}

	headers.set('Content-Type', 'application/json; charset=utf-8');

	return new Response(text, { status: 200, headers });
}

export function latestDate(dates: (Date | null)[]): Date | null {
	let latest: Date | null = null;

	for (const date of dates) {
		if (date !== null && (latest === null || date.getTime() > latest.getTime())) {
			latest = date;
		}
	}

	return latest;
}

function appendVary(current: string | null, value: string): string {
	if (current === null || current === '') {
		return value;
	}

	return `${current}, ${value}`;
}
