import type { Logger } from 'pino';
import { env as privateEnv } from '$env/dynamic/private';
import { EnvValidationError, missingSmtpKeys, parseEnv, type Env } from './config/env';
import { openDatabase, type AppDatabase } from './db';
import { createLogger } from './logging/logger';
import type { Runtime } from './runtime.interfaces';

let runtime: Runtime | undefined;

export function initRuntime(): Runtime {
	if (runtime) {
		return runtime;
	}

	const env = loadEnv();
	const logger = createLogger(env.LOG_LEVEL);
	const db = connectDatabase(env.DATABASE_PATH, logger);
	const initialized: Runtime = { env, logger, db };

	runtime = initialized;
	warnAboutIncompleteSmtp(env, logger);
	logger.info('Server runtime initialized');

	return initialized;
}

export function getRuntime(): Runtime {
	if (runtime) {
		return runtime;
	}

	return initRuntime();
}

function loadEnv(): Env {
	try {
		return parseEnv(privateEnv);
	} catch (error) {
		if (error instanceof EnvValidationError) {
			const bootstrapLogger = createLogger('info');

			bootstrapLogger.fatal({ err: error }, 'Refusing to start with an invalid environment');
		}

		throw error;
	}
}

function warnAboutIncompleteSmtp(env: Env, logger: Logger): void {
	const missingKeys = missingSmtpKeys(env);

	if (missingKeys.length > 0) {
		logger.warn(
			{ missingKeys },
			'Email is disabled because the SMTP configuration is incomplete'
		);
	}
}

function connectDatabase(path: string, logger: Logger): AppDatabase {
	try {
		return openDatabase(path);
	} catch (error) {
		logger.fatal({ err: error }, 'Could not open the database');

		throw error;
	}
}
