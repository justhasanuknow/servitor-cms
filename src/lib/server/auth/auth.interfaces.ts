import type { Logger } from 'pino';
import type { AppDatabase } from '../db';
import type { SecretKeys } from '../security/secret-keys.interfaces';
import type { AuthCookieJar } from './cookie-plugin.interfaces';

export interface AuthConfig {
	db: AppDatabase;
	origin: string;
	keys: SecretKeys;
	appName: string;
	logger: Logger;
	cookies: () => AuthCookieJar | undefined;
}
