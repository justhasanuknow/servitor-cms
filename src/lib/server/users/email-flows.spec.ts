import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyNewDevice } from '../auth/new-device';
import { signInWithPassword } from '../auth/sign-in';
import { auditLog, user, userProfiles } from '../db/schema';
import { TestCookieJar } from '../testing/cookie-jar';
import { createTestRuntime } from '../testing/runtime';
import { completePasswordReset } from './account-links';
import { confirmEmailChange, describeEmailChange, requestEmailChange } from './email-change';
import { requestPasswordReset } from './password-reset-request';

const PASSWORD = 'Kx7-quiet-harbor-19';

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let harness: ReturnType<typeof createTestRuntime>;

afterEach(() => {
	harness.dispose();
});

async function setUp(mail: boolean) {
	harness = createTestRuntime({ mail });
	await harness.createUser({ email: 'ada@example.com', password: PASSWORD, name: 'Ada' });
	await harness.createUser({ email: 'grace@example.com', password: PASSWORD, name: 'Grace' });

	return harness.signIn('ada@example.com', PASSWORD);
}

function linkIn(text: string): string {
	const match = /https:\/\/\S+|http:\/\/\S+/.exec(text);

	if (match === null) {
		throw new Error('Expected a link in the email');
	}

	return match[0];
}

function tokenOf(link: string): string {
	return link.split('/').at(-1) ?? '';
}

function emailOf(id: string): string {
	return (
		harness.runtime.db.select({ email: user.email }).from(user).where(eq(user.id, id)).get()
			?.email ?? ''
	);
}

const CONFIRM = { password: PASSWORD, totpCode: null };

describe('email change', () => {
	it('applies the change directly when email is off', async () => {
		const ada = await setUp(false);

		expect(
			await requestEmailChange(
				harness.runtime,
				harness.request(ada.jar),
				ada.actor,
				'ada.new@example.com',
				CONFIRM,
				'en'
			)
		).toBe('changed');
		expect(emailOf(ada.actor.id)).toBe('ada.new@example.com');
		expect(
			harness.runtime.db
				.select({ details: auditLog.details })
				.from(auditLog)
				.where(eq(auditLog.action, 'user.email_changed'))
				.get()?.details
		).toEqual({ from: 'ada@example.com', to: 'ada.new@example.com', verified: false });
	});

	it('verifies the new address first when email is on and notifies the old one', async () => {
		const ada = await setUp(true);

		expect(
			await requestEmailChange(
				harness.runtime,
				harness.request(ada.jar),
				ada.actor,
				'ada.new@example.com',
				CONFIRM,
				'en'
			)
		).toBe('verification_sent');
		expect(emailOf(ada.actor.id)).toBe('ada@example.com');
		expect(harness.emails).toHaveLength(1);
		expect(harness.emails[0].to).toBe('ada.new@example.com');

		const token = tokenOf(linkIn(harness.emails[0].text));

		expect(linkIn(harness.emails[0].text)).toContain('/panel/verify-email/');
		expect(describeEmailChange(harness.runtime.db, token)).toEqual({
			newEmail: 'ada.new@example.com'
		});
		expect(
			confirmEmailChange(harness.runtime, harness.request(new TestCookieJar()), token, 'en')
		).toBe('changed');
		expect(emailOf(ada.actor.id)).toBe('ada.new@example.com');
		await vi.waitFor(() => expect(harness.emails).toHaveLength(2));
		expect(harness.emails[1].to).toBe('ada@example.com');
		expect(harness.emails[1].text).toContain('ada.new@example.com');
		expect(
			confirmEmailChange(harness.runtime, harness.request(new TestCookieJar()), token, 'en')
		).toBe('invalid_link');
	});

	it('refuses taken, unchanged and unconfirmed changes', async () => {
		const ada = await setUp(false);
		const request = harness.request(ada.jar);

		expect(
			await requestEmailChange(
				harness.runtime,
				request,
				ada.actor,
				'grace@example.com',
				CONFIRM,
				'en'
			)
		).toBe('email_taken');
		expect(
			await requestEmailChange(
				harness.runtime,
				request,
				ada.actor,
				'ada@example.com',
				CONFIRM,
				'en'
			)
		).toBe('unchanged');
		expect(
			await requestEmailChange(
				harness.runtime,
				request,
				ada.actor,
				'other@example.com',
				{ password: 'wrong-password-123', totpCode: null },
				'en'
			)
		).toBe('invalid_password');
	});

	it('writes the email in the language of the user', async () => {
		const ada = await setUp(true);

		harness.runtime.db
			.update(userProfiles)
			.set({ uiLocale: 'tr' })
			.where(eq(userProfiles.userId, ada.actor.id))
			.run();
		await requestEmailChange(
			harness.runtime,
			harness.request(ada.jar),
			ada.actor,
			'ada.new@example.com',
			CONFIRM,
			'en'
		);

		expect(harness.emails[0].subject).toContain('onaylayın');
	});
});

describe('password reset requests', () => {
	it('emails a working reset link only to existing active accounts', async () => {
		await setUp(true);

		expect(
			requestPasswordReset(
				harness.runtime,
				harness.request(new TestCookieJar()),
				'nobody@example.com',
				'en'
			)
		).toBe('requested');
		expect(
			requestPasswordReset(
				harness.runtime,
				harness.request(new TestCookieJar()),
				'grace@example.com',
				'en'
			)
		).toBe('requested');
		await vi.waitFor(() => expect(harness.emails).toHaveLength(1));
		expect(harness.emails[0].to).toBe('grace@example.com');

		const token = tokenOf(linkIn(harness.emails[0].text));

		expect(
			await completePasswordReset(
				harness.runtime,
				harness.request(new TestCookieJar()),
				token,
				{
					password: 'Brand-new-passphrase-42',
					confirmation: 'Brand-new-passphrase-42'
				}
			)
		).toBe('completed');
	});

	it('does not email deactivated accounts', async () => {
		await setUp(true);
		harness.runtime.db
			.update(user)
			.set({ deactivatedAt: new Date() })
			.where(eq(user.email, 'grace@example.com'))
			.run();

		expect(
			requestPasswordReset(
				harness.runtime,
				harness.request(new TestCookieJar()),
				'grace@example.com',
				'en'
			)
		).toBe('requested');
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(harness.emails).toEqual([]);
	});

	it('limits requests per address silently and per client visibly', async () => {
		await setUp(true);

		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect(
				requestPasswordReset(
					harness.runtime,
					harness.request(new TestCookieJar(), `198.51.100.${attempt + 10}`),
					'grace@example.com',
					'en'
				)
			).toBe('requested');
		}

		await vi.waitFor(() => expect(harness.emails).toHaveLength(3));

		for (let attempt = 0; attempt < 10; attempt += 1) {
			requestPasswordReset(
				harness.runtime,
				harness.request(new TestCookieJar(), '192.0.2.50'),
				`x${attempt}@example.com`,
				'en'
			);
		}

		expect(
			requestPasswordReset(
				harness.runtime,
				harness.request(new TestCookieJar(), '192.0.2.50'),
				'y@example.com',
				'en'
			)
		).toBe('rate_limited');
	});

	it('is unavailable without email', async () => {
		await setUp(false);

		expect(
			requestPasswordReset(
				harness.runtime,
				harness.request(new TestCookieJar()),
				'grace@example.com',
				'en'
			)
		).toBe('unavailable');
	});
});

describe('new device notifications', () => {
	it('warns about sign-ins from a device that was not used before', async () => {
		await setUp(true);

		expect(harness.emails).toEqual([]);

		await harness.signIn('ada@example.com', PASSWORD);

		expect(harness.emails).toEqual([]);

		const request = harness.request(new TestCookieJar(), '203.0.113.77');

		request.headers.set('user-agent', IPHONE);

		expect(
			await signInWithPassword(
				harness.runtime,
				{ ...request, userAgent: IPHONE },
				{ email: 'ada@example.com', password: PASSWORD }
			)
		).toEqual({ status: 'signed_in' });
		await vi.waitFor(() => expect(harness.emails).toHaveLength(1));
		expect(harness.emails[0].to).toBe('ada@example.com');
		expect(harness.emails[0].text).toContain('Safari');
		expect(harness.emails[0].text).toContain('203.0.113.77');
	});

	it('stays quiet when email is off', async () => {
		const ada = await setUp(false);
		const request = harness.request(ada.jar);

		notifyNewDevice(harness.runtime, { ...request, userAgent: IPHONE }, ada.actor.id);

		expect(harness.emails).toEqual([]);
	});
});
