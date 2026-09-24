import type { RequestEvent } from '@sveltejs/kit';
import { requestMetadata } from '../http/client-address';
import type { AuthRequest } from './auth-request.interfaces';

export const CLIENT_IP_HEADER = 'x-servitor-client-ip';

export function createAuthRequest(event: RequestEvent): AuthRequest {
	const metadata = requestMetadata(event);
	const headers = new Headers(event.request.headers);

	headers.delete(CLIENT_IP_HEADER);

	if (metadata.ip !== null) {
		headers.set(CLIENT_IP_HEADER, metadata.ip);
	}

	return { headers, ip: metadata.ip, userAgent: metadata.userAgent };
}
