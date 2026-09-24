import { describe, expect, it } from 'vitest';
import { LOGIN_LOCKOUT_POLICY, LoginLockout } from './login-lockout';

const MINUTE = 60 * 1000;

function createClock(start = 1_000_000) {
	let current = start;

	return {
		now: () => current,
		advance(ms: number): void {
			current += ms;
		}
	};
}

function failRepeatedly(lockout: LoginLockout, subject: string, times: number): void {
	for (let attempt = 0; attempt < times; attempt += 1) {
		lockout.recordFailure(subject);
	}
}

describe('LoginLockout', () => {
	it('locks the account after 10 failures within 15 minutes', () => {
		const lockout = new LoginLockout(createClock().now);

		failRepeatedly(lockout, 'user@example.com', LOGIN_LOCKOUT_POLICY.maxFailures - 1);

		expect(lockout.isLocked('user@example.com')).toBe(false);
		expect(lockout.recordFailure('user@example.com')).toEqual({
			locked: true,
			lockedNow: true
		});
		expect(lockout.isLocked('user@example.com')).toBe(true);
	});

	it('does not extend a lock while it is active', () => {
		const clock = createClock();
		const lockout = new LoginLockout(clock.now);

		failRepeatedly(lockout, 'user@example.com', LOGIN_LOCKOUT_POLICY.maxFailures);
		clock.advance(14 * MINUTE);

		expect(lockout.recordFailure('user@example.com')).toEqual({
			locked: true,
			lockedNow: false
		});

		clock.advance(MINUTE);

		expect(lockout.isLocked('user@example.com')).toBe(false);
	});

	it('forgets failures once the 15 minute window has passed', () => {
		const clock = createClock();
		const lockout = new LoginLockout(clock.now);

		failRepeatedly(lockout, 'user@example.com', LOGIN_LOCKOUT_POLICY.maxFailures - 1);
		clock.advance(15 * MINUTE);

		expect(lockout.recordFailure('user@example.com')).toEqual({
			locked: false,
			lockedNow: false
		});
	});

	it('clears failures after a successful sign-in', () => {
		const lockout = new LoginLockout(createClock().now);

		failRepeatedly(lockout, 'user@example.com', LOGIN_LOCKOUT_POLICY.maxFailures - 1);
		lockout.reset('user@example.com');

		expect(lockout.recordFailure('user@example.com')).toEqual({
			locked: false,
			lockedNow: false
		});
	});

	it('tracks every submitted email, including unknown ones, separately', () => {
		const lockout = new LoginLockout(createClock().now);

		failRepeatedly(lockout, 'missing@example.com', LOGIN_LOCKOUT_POLICY.maxFailures);

		expect(lockout.isLocked('missing@example.com')).toBe(true);
		expect(lockout.isLocked('user@example.com')).toBe(false);
	});
});
