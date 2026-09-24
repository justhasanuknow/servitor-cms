import type { LockoutEntry, LockoutUpdate } from './login-lockout.interfaces';

const DEFAULT_MAX_ENTRIES = 100_000;

export const LOGIN_LOCKOUT_POLICY = {
	maxFailures: 10,
	windowMs: 15 * 60 * 1000,
	lockMs: 15 * 60 * 1000
} as const;

export class LoginLockout {
	readonly #entries = new Map<string, LockoutEntry>();

	readonly #now: () => number;

	readonly #maxEntries: number;

	constructor(now: () => number = Date.now, maxEntries: number = DEFAULT_MAX_ENTRIES) {
		this.#now = now;
		this.#maxEntries = maxEntries;
	}

	isLocked(subject: string): boolean {
		const entry = this.#activeEntry(subject);

		return entry !== undefined && entry.lockedUntil !== null;
	}

	recordFailure(subject: string): LockoutUpdate {
		const now = this.#now();
		const entry = this.#activeEntry(subject);

		if (entry && entry.lockedUntil !== null) {
			return { locked: true, lockedNow: false };
		}

		const next = entry ?? { failures: 0, windowStart: now, lockedUntil: null };

		next.failures += 1;

		if (next.failures >= LOGIN_LOCKOUT_POLICY.maxFailures) {
			next.lockedUntil = now + LOGIN_LOCKOUT_POLICY.lockMs;
		}

		this.#entries.set(subject, next);
		this.#prune();

		return { locked: next.lockedUntil !== null, lockedNow: next.lockedUntil !== null };
	}

	reset(subject: string): void {
		this.#entries.delete(subject);
	}

	#activeEntry(subject: string): LockoutEntry | undefined {
		const entry = this.#entries.get(subject);

		if (!entry) {
			return undefined;
		}

		if (this.#isExpired(entry, this.#now())) {
			this.#entries.delete(subject);

			return undefined;
		}

		return entry;
	}

	#isExpired(entry: LockoutEntry, now: number): boolean {
		if (entry.lockedUntil !== null) {
			return entry.lockedUntil <= now;
		}

		return now - entry.windowStart >= LOGIN_LOCKOUT_POLICY.windowMs;
	}

	#prune(): void {
		if (this.#entries.size <= this.#maxEntries) {
			return;
		}

		const now = this.#now();

		for (const [subject, entry] of this.#entries) {
			if (this.#isExpired(entry, now)) {
				this.#entries.delete(subject);
			}
		}

		for (const subject of this.#entries.keys()) {
			if (this.#entries.size <= this.#maxEntries) {
				return;
			}

			this.#entries.delete(subject);
		}
	}
}
