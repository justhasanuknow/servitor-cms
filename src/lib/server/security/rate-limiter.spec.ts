import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter';

const RULE = { windowMs: 10_000, max: 3 };

function createClock(start = 1_000_000) {
	let current = start;

	return {
		now: () => current,
		advance(ms: number): void {
			current += ms;
		}
	};
}

describe('RateLimiter', () => {
	it('allows requests up to the limit within a window', () => {
		const limiter = new RateLimiter(createClock().now);

		expect(limiter.consume('ip', RULE).allowed).toBe(true);
		expect(limiter.consume('ip', RULE).allowed).toBe(true);
		expect(limiter.consume('ip', RULE).allowed).toBe(true);
		expect(limiter.consume('ip', RULE)).toEqual({ allowed: false, retryAfterSeconds: 10 });
	});

	it('starts a new window once the previous one has passed', () => {
		const clock = createClock();
		const limiter = new RateLimiter(clock.now);

		for (let attempt = 0; attempt < 3; attempt += 1) {
			limiter.consume('ip', RULE);
		}

		clock.advance(10_000);

		expect(limiter.consume('ip', RULE).allowed).toBe(true);
	});

	it('tracks keys independently', () => {
		const limiter = new RateLimiter(createClock().now);

		for (let attempt = 0; attempt < 3; attempt += 1) {
			limiter.consume('first', RULE);
		}

		expect(limiter.consume('first', RULE).allowed).toBe(false);
		expect(limiter.consume('second', RULE).allowed).toBe(true);
	});

	it('keeps its memory bounded by dropping the oldest entries', () => {
		const limiter = new RateLimiter(createClock().now, 2);

		for (let attempt = 0; attempt < 3; attempt += 1) {
			limiter.consume('a', RULE);
		}

		limiter.consume('b', RULE);
		limiter.consume('c', RULE);

		expect(limiter.consume('a', RULE).allowed).toBe(true);
	});
});
