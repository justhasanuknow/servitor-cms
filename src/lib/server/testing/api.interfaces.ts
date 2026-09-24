export interface TestApiKeyOptions {
	name?: string;
	languages?: string[];
	categories?: string[];
	rateLimitPerMinute?: number;
	expiresAt?: Date;
	revokedAt?: Date;
}
