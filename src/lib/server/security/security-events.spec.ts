import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { languagesEndpoint } from '../api/api-endpoints';
import { preflightResponse } from '../api/cors-headers';
import { reauthenticate } from '../auth/reauthentication';
import { createLogger } from '../logging/logger';
import { requirePermission } from '../permissions/permissions';
import { apiRequest, insertTestApiKey } from '../testing/api';
import { createTestRuntime } from '../testing/runtime';
import { logSecurityEvent, onSecurityEvent, reportSecurityEvent } from './security-events';
import type { SecurityEvent } from './security-events.interfaces';

const EMAIL = 'author@example.com';

const PASSWORD = 'Kx7-quiet-harbor-19';

let events: SecurityEvent[];

let stopListening: () => void;

beforeEach(() => {
	events = [];
	stopListening = onSecurityEvent((event) => events.push(event));
});

afterEach(() => {
	stopListening();
});

describe('security events', () => {
	it('reach every listener until it stops listening', () => {
		reportSecurityEvent({ type: 'rate_limited', limit: 'sign_in' });
		stopListening();
		reportSecurityEvent({ type: 'rate_limited', limit: 'sign_in' });

		expect(events).toEqual([{ type: 'rate_limited', limit: 'sign_in' }]);
	});

	it('are logged as warnings with their request context', () => {
		const lines: string[] = [];
		const logger = createLogger('info', {
			write(line: string) {
				lines.push(line);
			}
		});

		logSecurityEvent(
			logger,
			{ type: 'permission_denied', actorId: 'user-1', action: 'settings.manage' },
			{ requestId: 'request-1', method: 'POST', route: '/panel/settings', ip: '192.0.2.1' }
		);

		expect(JSON.parse(lines[0])).toMatchObject({
			level: 'warn',
			msg: 'Security event',
			securityEvent: {
				type: 'permission_denied',
				actorId: 'user-1',
				action: 'settings.manage'
			},
			request: {
				requestId: 'request-1',
				method: 'POST',
				route: '/panel/settings',
				ip: '192.0.2.1'
			}
		});
	});

	it('record refused permissions', () => {
		const actor = { id: 'author-1', role: 'author' as const, canPublishDirectly: false };

		expect(() => requirePermission(actor, 'settings.manage', null)).toThrow();
		expect(() => requirePermission(null, 'audit.view', null)).toThrow();
		expect(events).toEqual([
			{ type: 'permission_denied', actorId: 'author-1', action: 'settings.manage' },
			{ type: 'permission_denied', actorId: null, action: 'audit.view' }
		]);
	});

	it('record refused CORS preflights', () => {
		expect(preflightResponse(null, 'https://evil.example').status).toBe(403);
		expect(preflightResponse('https://app.example', 'https://app.example').status).toBe(204);
		expect(events).toEqual([{ type: 'cors_origin_rejected', origin: 'https://evil.example' }]);
	});
});

describe('security events from the runtime', () => {
	let harness: ReturnType<typeof createTestRuntime>;

	beforeEach(() => {
		harness = createTestRuntime();
	});

	afterEach(() => {
		harness.dispose();
	});

	it('record rejected API credentials but not ordinary requests', async () => {
		const founderId = await harness.createUser({
			email: EMAIL,
			password: PASSWORD,
			role: 'founder'
		});
		const { key } = insertTestApiKey(harness.runtime.db, founderId);

		expect(languagesEndpoint(harness.runtime, apiRequest('/languages', null)).status).toBe(401);
		expect(
			languagesEndpoint(harness.runtime, apiRequest('/languages', 'svt_unknown')).status
		).toBe(401);
		expect(languagesEndpoint(harness.runtime, apiRequest('/languages', key)).status).toBe(200);
		expect(events).toEqual([
			{ type: 'api_request_rejected', status: 401, code: 'unauthorized' },
			{ type: 'api_request_rejected', status: 401, code: 'unauthorized' }
		]);
	});

	it('record failed re-authentication for sensitive actions', async () => {
		await harness.createUser({ email: EMAIL, password: PASSWORD });

		const { jar, actor } = await harness.signIn(EMAIL, PASSWORD);

		expect(
			await reauthenticate(harness.runtime, harness.request(jar), actor, {
				password: 'Kx7-wrong-harbor-19',
				totpCode: null
			})
		).toBe('invalid_password');
		expect(events).toEqual([
			{ type: 'reauthentication_failed', userId: actor.id, reason: 'invalid_password' }
		]);
	});
});
