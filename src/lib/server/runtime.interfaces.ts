import type { Logger } from 'pino';
import type { Env } from './config/env';
import type { AppDatabase } from './db';

export interface Runtime {
	readonly env: Env;
	readonly logger: Logger;
	readonly db: AppDatabase;
}
