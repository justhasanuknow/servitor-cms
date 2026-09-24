import type { Logger } from 'pino';
import { getRequestEvent } from '$app/server';
import { env as privateEnv } from '$env/dynamic/private';
import { createAuth } from './auth/auth';
import type { AuthCookieJar } from './auth/cookie-plugin.interfaces';
import { ensureFounder } from './auth/founder-seed';
import { LoginLockout } from './auth/login-lockout';
import { EnvValidationError, missingSmtpKeys, parseEnv, type Env } from './config/env';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase, type AppDatabase } from './db';
import { ensureDefaultContentLanguage } from './languages/languages';
import { createLogger } from './logging/logger';
import type { Runtime } from './runtime.interfaces';
import { RateLimiter } from './security/rate-limiter';

let runtime: Runtime | undefined;

let bootstrapLogger: Logger | undefined;

export function initRuntime(): Runtime {
	if (runtime) {
		return runtime;
	}

	const env = loadEnv();
	const logger = createLogger(env.LOG_LEVEL);
	const db = prepareDatabase(env.DATABASE_PATH, logger);
	const auth = createAuth({
		db,
		origin: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		appName: new URL(env.ORIGIN).host,
		logger,
		cookies: currentRequestCookies
	});
	const initialized: Runtime = {
		env,
		logger,
		db,
		auth,
		rateLimiter: new RateLimiter(),
		loginLockout: new LoginLockout()
	};

	runtime = initialized;
	warnAboutIncompleteSmtp(env, logger);
	logger.info('Server runtime initialized');

	return initialized;
}

export async function startRuntime(): Promise<Runtime> {
	const started = initRuntime();

	ensureDefaultContentLanguage(started.db, started.env, started.logger);

	try {
		await ensureFounder(started.db, started.env, started.logger);
	} catch (error) {
		started.logger.fatal({ err: error }, 'Could not create the founder account');

		throw error;
	}

	return started;
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

function currentRequestCookies(): AuthCookieJar | undefined {
	try {
		return getRequestEvent().cookies;
	} catch {
		return undefined;
	}
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
