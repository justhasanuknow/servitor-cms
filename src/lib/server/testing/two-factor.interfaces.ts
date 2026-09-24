import type { AuthUser } from '../auth/auth';
import type { TestCookieJar } from './cookie-jar';

export interface TwoFactorUser {
	jar: TestCookieJar;
	actor: AuthUser;
	spareCodes: string[];
}
