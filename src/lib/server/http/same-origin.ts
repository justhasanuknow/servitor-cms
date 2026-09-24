import { error } from '@sveltejs/kit';

export function requireSameOrigin(request: Request, origin: string): void {
	if (request.headers.get('origin') !== origin) {
		error(403, { message: 'Forbidden' });
	}
}
