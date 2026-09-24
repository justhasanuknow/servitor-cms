import type { Logger } from 'pino';
import type { Auth } from './auth/auth';
import type { LoginLockout } from './auth/login-lockout';
import type { TotpReplayGuard } from './auth/totp-replay';
import type { Env } from './config/env';
import type { AppDatabase } from './db';
import type { Mailer } from './email/mailer.interfaces';
import type { MediaStore } from './media/media-store';
import type { RateLimiter } from './security/rate-limiter';

export interface Runtime {
	readonly env: Env;
	readonly logger: Logger;
	readonly db: AppDatabase;
	readonly auth: Auth;
	readonly rateLimiter: RateLimiter;
	readonly loginLockout: LoginLockout;
	readonly totpReplay: TotpReplayGuard;
	readonly media: MediaStore;
	readonly mailer: Mailer;
}
