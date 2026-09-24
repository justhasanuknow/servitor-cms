import type { RequestEvent } from '@sveltejs/kit';
import type { RequestMetadata } from './client-address.interfaces';

const MAX_USER_AGENT_LENGTH = 512;

export function clientAddress(event: RequestEvent): string | null {
	try {
		return event.getClientAddress();
	} catch {
		return null;
	}
}

export function requestMetadata(event: RequestEvent): RequestMetadata {
	const userAgent = event.request.headers.get('user-agent');

	if (userAgent === null) {
		return { ip: clientAddress(event), userAgent: null };
	}

	return { ip: clientAddress(event), userAgent: userAgent.slice(0, MAX_USER_AGENT_LENGTH) };
}
