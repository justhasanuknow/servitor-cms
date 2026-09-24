export const TOTP_REUSE_WINDOW_MS = 2 * 60 * 1000;

const DEFAULT_MAX_ENTRIES = 100_000;

export class TotpReplayGuard {
	readonly #usedUntil = new Map<string, number>();

	readonly #now: () => number;

	readonly #maxEntries: number;

	constructor(now: () => number = Date.now, maxEntries: number = DEFAULT_MAX_ENTRIES) {
		this.#now = now;
		this.#maxEntries = maxEntries;
	}

	wasUsed(userId: string, code: string): boolean {
		const usedUntil = this.#usedUntil.get(this.#key(userId, code));

		return usedUntil !== undefined && usedUntil > this.#now();
	}

	remember(userId: string, code: string): void {
		this.#prune();
		this.#usedUntil.set(this.#key(userId, code), this.#now() + TOTP_REUSE_WINDOW_MS);
	}

	#key(userId: string, code: string): string {
		return `${userId}:${code}`;
	}

	#prune(): void {
		const now = this.#now();

		for (const [key, usedUntil] of this.#usedUntil) {
			if (usedUntil <= now) {
				this.#usedUntil.delete(key);
			}
		}

		while (this.#usedUntil.size >= this.#maxEntries) {
			const oldest = this.#usedUntil.keys().next();

			if (oldest.done === true) {
				return;
			}

			this.#usedUntil.delete(oldest.value);
		}
	}
}
