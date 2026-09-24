import type { Logger } from 'pino';
import { env as privateEnv } from '$env/dynamic/private';
import { EnvValidationError, missingSmtpKeys, parseEnv, type Env } from './config/env';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase, type AppDatabase } from './db';
import { createLogger } from './logging/logger';
import type { Runtime } from './runtime.interfaces';

let runtime: Runtime | undefined;

let bootstrapLogger: Logger | undefined;

export function initRuntime(): Runtime {
	if (runtime) {
		return runtime;
	}

	const env = loadEnv();
	const logger = createLogger(env.LOG_LEVEL);
	const db = prepareDatabase(env.DATABASE_PATH, logger);
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

export function getLogger(): Logger {
	if (runtime) {
		return runtime.logger;
	}

	if (!bootstrapLogger) {
		bootstrapLogger = createLogger('info');
	}

	return bootstrapLogger;
}

function loadEnv(): Env {
	try {
		return parseEnv(privateEnv);
	} catch (error) {
		if (error instanceof EnvValidationError) {
			getLogger().fatal({ err: error }, 'Refusing to start with an invalid environment');
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

function prepareDatabase(path: string, logger: Logger): AppDatabase {
	try {
		const db = openDatabase(path);

		migrateDatabase(db, MIGRATIONS_FOLDER);
		logger.info('Database migrations applied');

		return db;
	} catch (error) {
		logger.fatal({ err: error }, 'Could not prepare the database');

		throw error;
	}
}
