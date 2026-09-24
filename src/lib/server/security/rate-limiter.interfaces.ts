export interface RateLimitRule {
	windowMs: number;
	max: number;
}

export interface RateLimitDecision {
	allowed: boolean;
	retryAfterSeconds: number;
}

export interface RateLimitBucket {
	windowStart: number;
	windowMs: number;
	count: number;
}
