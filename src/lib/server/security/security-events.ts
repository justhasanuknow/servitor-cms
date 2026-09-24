import type { Logger } from 'pino';
import type {
	SecurityEvent,
	SecurityEventContext,
	SecurityEventListener
} from './security-events.interfaces';

const listeners = new Set<SecurityEventListener>();

export function onSecurityEvent(listener: SecurityEventListener): () => void {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

export function reportSecurityEvent(event: SecurityEvent): void {
	for (const listener of listeners) {
		listener(event);
	}
}

export function logSecurityEvent(
	logger: Logger,
	event: SecurityEvent,
	context: SecurityEventContext | null
): void {
	logger.warn({ securityEvent: event, request: context }, 'Security event');
}
