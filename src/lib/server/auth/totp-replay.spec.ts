import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestRuntime } from '../testing/runtime';
import { generateTotp, nextTotp } from '../testing/totp';
import { reauthenticate } from './reauthentication';
import { TOTP_REUSE_WINDOW_MS, TotpReplayGuard } from './totp-replay';
import { confirmTwoFactorEnrollment, startTwoFactorEnrollment } from './two-factor-settings';

const PASSWORD = 'Kx7-quiet-harbor-19';

describe('TotpReplayGuard', () => {
	it('remembers used codes per user for the whole reuse window', () => {
		let now = 0;
		const guard = new TotpReplayGuard(() => now);

		guard.remember('user-1', '123456');

		expect(guard.wasUsed('user-1', '123456')).toBe(true);
		expect(guard.wasUsed('user-2', '123456')).toBe(false);
		expect(guard.wasUsed('user-1', '654321')).toBe(false);

		now = TOTP_REUSE_WINDOW_MS - 1;

		expect(guard.wasUsed('user-1', '123456')).toBe(true);

		now = TOTP_REUSE_WINDOW_MS;

		expect(guard.wasUsed('user-1', '123456')).toBe(false);
	});

	it('outlasts the 90 seconds in which an authenticator code is accepted', () => {
		expect(TOTP_REUSE_WINDOW_MS).toBeGreaterThanOrEqual(90_000);
	});

	it('stays bounded', () => {
		const guard = new TotpReplayGuard(() => 0, 3);

		for (const code of ['111111', '222222', '333333', '444444']) {
			guard.remember('user-1', code);
		}

		expect(guard.wasUsed('user-1', '111111')).toBe(false);
		expect(guard.wasUsed('user-1', '444444')).toBe(true);
	});
});

describe('authenticator codes for sensitive actions', () => {
	let harness: ReturnType<typeof createTestRuntime>;

	beforeEach(() => {
		harness = createTestRuntime();
	});

	afterEach(() => {
		harness.dispose();
	});

	it('confirm only one action each', async () => {
		await harness.createUser({ email: 'author@example.com', password: PASSWORD });

		const { jar, actor } = await harness.signIn('author@example.com', PASSWORD);
		const started = await startTwoFactorEnrollment(
			harness.runtime,
			harness.request(jar),
			actor,
			PASSWORD
		);

		if (started.status !== 'started') {
			throw new Error(`Enrollment did not start: ${started.status}`);
		}

		expect(
			await confirmTwoFactorEnrollment(
				harness.runtime,
				harness.request(jar),
				actor,
				generateTotp(started.enrollment.secret)
			)
		).toBe('enabled');

		const enrolled = (await harness.currentSession(jar)).user;
		const code = nextTotp(started.enrollment.secret);

		harness.advanceClock(10_000);

		expect(
			await reauthenticate(harness.runtime, harness.request(jar), enrolled, {
				password: PASSWORD,
				totpCode: code
			})
		).toBe('verified');
		expect(
			await reauthenticate(harness.runtime, harness.request(jar), enrolled, {
				password: PASSWORD,
				totpCode: code
			})
		).toBe('invalid_code');
	});
});
