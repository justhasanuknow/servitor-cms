import type { RateLimitBucket, RateLimitDecision, RateLimitRule } from './rate-limiter.interfaces';

const DEFAULT_MAX_ENTRIES = 100_000;

export const RATE_LIMIT_RULES = {
	signIn: { windowMs: 10_000, max: 3 },
	twoFactor: { windowMs: 10_000, max: 3 },
	sensitiveAction: { windowMs: 10_000, max: 3 }
} as const satisfies Record<string, RateLimitRule>;

export class RateLimiter {
	readonly #buckets = new Map<string, RateLimitBucket>();

	readonly #now: () => number;

	readonly #maxEntries: number;

	constructor(now: () => number = Date.now, maxEntries: number = DEFAULT_MAX_ENTRIES) {
		this.#now = now;
		this.#maxEntries = maxEntries;
	}

	consume(key: string, rule: RateLimitRule): RateLimitDecision {
		const now = this.#now();
		const bucket = this.#buckets.get(key);

		if (!bucket || now - bucket.windowStart >= bucket.windowMs) {
			this.#buckets.set(key, { windowStart: now, windowMs: rule.windowMs, count: 1 });
			this.#prune(now);

			return {
				allowed: true,
				retryAfterSeconds: 0,
				remaining: Math.max(0, rule.max - 1),
				resetSeconds: Math.ceil(rule.windowMs / 1000)
			};
		}

		const resetSeconds = Math.ceil((bucket.windowStart + bucket.windowMs - now) / 1000);

		if (bucket.count >= rule.max) {
			return { allowed: false, retryAfterSeconds: resetSeconds, remaining: 0, resetSeconds };
		}

		bucket.count += 1;

		return {
			allowed: true,
			retryAfterSeconds: 0,
			remaining: Math.max(0, rule.max - bucket.count),
			resetSeconds
		};
	}

	#prune(now: number): void {
		if (this.#buckets.size <= this.#maxEntries) {
			return;
		}

		for (const [key, bucket] of this.#buckets) {
			if (now - bucket.windowStart >= bucket.windowMs) {
				this.#buckets.delete(key);
			}
		}

		for (const key of this.#buckets.keys()) {
			if (this.#buckets.size <= this.#maxEntries) {
				return;
			}

			this.#buckets.delete(key);
		}
	}
}
