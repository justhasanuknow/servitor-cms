import type { Logger } from 'pino';
import { getRequestEvent } from '$app/server';
import { env as privateEnv } from '$env/dynamic/private';
import { onAuditEntry } from './audit/audit-log';
import { createAuth } from './auth/auth';
import type { AuthCookieJar } from './auth/cookie-plugin.interfaces';
import { ensureFounder } from './auth/founder-seed';
import { LoginLockout } from './auth/login-lockout';
import { TotpReplayGuard } from './auth/totp-replay';
import { EnvValidationError, missingSmtpKeys, readEnv, type Env } from './config/env';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase, type AppDatabase } from './db';
import { createMailer } from './email/mailer';
import { requestMetadata } from './http/client-address';
import { ensureDefaultContentLanguage } from './languages/languages';
import { createLogger } from './logging/logger';
import { MediaStore } from './media/media-store';
import { dataPaths } from './operations/backup';
import { applyPendingRestore } from './operations/restore-request';
import type { RestoreOutcome } from './operations/restore-request.interfaces';
import { recordRestoreOutcome } from './backups/restore-outcome';
import type { Runtime } from './runtime.interfaces';
import { RateLimiter } from './security/rate-limiter';
import { secretKeys } from './security/secret-keys';
import { logSecurityEvent, onSecurityEvent } from './security/security-events';
import type { SecurityEventContext } from './security/security-events.interfaces';
import { reencryptStoredSecrets } from './security/stored-secrets';

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
		keys: secretKeys(env),
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
		loginLockout: new LoginLockout(),
		totpReplay: new TotpReplayGuard(),
		media: prepareMediaStore(env.UPLOADS_DIR, logger),
		mailer: createMailer(env)
	};

	runtime = initialized;
	onSecurityEvent((event) => logSecurityEvent(logger, event, currentRequestContext()));
	onAuditEntry((entry) => logger.info({ audit: entry }, 'Audit event'));
	warnAboutIncompleteSmtp(env, logger);
	logger.info('Server runtime initialized');

	return initialized;
}

export async function startRuntime(): Promise<Runtime> {
	const outcome = await applyRequestedRestore();
	const started = initRuntime();

	recordRestoreOutcome(started, outcome);
	ensureDefaultContentLanguage(started.db, started.env, started.logger);

	try {
		await ensureFounder(started.db, started.env, started.logger);
	} catch (error) {
		started.logger.fatal({ err: error }, 'Could not create the founder account');

		throw error;
	}

	await refreshStoredSecrets(started);

	return started;
}

async function applyRequestedRestore(): Promise<RestoreOutcome | null> {
	if (runtime) {
		return null;
	}

	const env = loadEnv();

	try {
		return await applyPendingRestore(dataPaths(env));
	} catch (error) {
		getLogger().error({ err: error }, 'The requested restore could not be applied');

		return null;
	}
}

async function refreshStoredSecrets(runtime: Runtime): Promise<void> {
	const report = await reencryptStoredSecrets(runtime.db, secretKeys(runtime.env));

	if (report.reencrypted > 0) {
		runtime.logger.info(
			{ reencrypted: report.reencrypted },
			'Stored secrets were encrypted again with the current key'
		);
	}

	if (report.unreadable > 0) {
		runtime.logger.warn(
			{ unreadable: report.unreadable },
			'Some stored secrets cannot be decrypted with the configured keys'
		);
	}
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

function currentRequestContext(): SecurityEventContext | null {
	try {
		const event = getRequestEvent();

		return {
			requestId: event.locals.requestId,
			method: event.request.method,
			route: event.route.id,
			ip: requestMetadata(event).ip
		};
	} catch {
		return null;
	}
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
		return readEnv(privateEnv);
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

function prepareMediaStore(root: string, logger: Logger): MediaStore {
	const store = new MediaStore(root);

	try {
		store.prepare();
	} catch (error) {
		logger.fatal({ err: error }, 'Could not prepare the uploads directory');

		throw error;
	}

	return store;
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
