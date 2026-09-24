import type { Logger } from 'pino';
import type { AppDatabase } from '../db';
import type { AuthCookieJar } from './cookie-plugin.interfaces';

export interface AuthConfig {
	db: AppDatabase;
	origin: string;
	secret: string;
	appName: string;
	logger: Logger;
	cookies: () => AuthCookieJar | undefined;
}
