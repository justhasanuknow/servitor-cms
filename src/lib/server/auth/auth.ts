import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { AppDatabase } from '../db';
import * as schema from '../db/schema';
import { versionedSecrets } from '../security/secret-keys';
import type { AuthConfig } from './auth.interfaces';
import { AUTH_COOKIE_PREFIX } from './auth-cookies';
import { CLIENT_IP_HEADER } from './auth-request';
import { backupCodeStorage, generateBackupCodes, hashBackupCode } from './backup-codes';
import { requestCookies } from './cookie-plugin';
import { authSchemaOptions } from './options';
import { hashPassword, verifyPassword } from './password-hash';
import {
	findPasswordPolicyViolation,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH
} from './password-policy';
import { twoFactorChallenge } from './two-factor-challenge';

const SESSION_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

const BACKUP_CODE_PATH = '/two-factor/verify-backup-code';

const NEW_PASSWORD_PATHS = new Set(['/change-password', '/reset-password', '/set-password']);

const backupCodeBodySchema = z.object({ code: z.string().max(100) });

const newPasswordBodySchema = z.object({ newPassword: z.string() });

export function createAuth(config: AuthConfig) {
	return betterAuth({
		appName: config.appName,
		baseURL: config.origin,
		secret: config.keys.current,
		secrets: versionedSecrets(config.keys),
		database: drizzleAdapter(config.db, { provider: 'sqlite', schema }),
		logger: {
			level: 'warn',
			log: (level, message) => {
				writeAuthLog(config.logger, level, message);
			}
		},
		telemetry: {
			enabled: false
		},
		advanced: {
			...authSchemaOptions.advanced,
			cookiePrefix: AUTH_COOKIE_PREFIX,
			ipAddress: {
				ipAddressHeaders: [CLIENT_IP_HEADER]
			}
		},
		user: authSchemaOptions.user,
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			autoSignIn: false,
			minPasswordLength: PASSWORD_MIN_LENGTH,
			maxPasswordLength: PASSWORD_MAX_LENGTH,
			password: {
				hash: hashPassword,
				verify: ({ hash, password }) => verifyPassword(hash, password)
			}
		},
		session: {
			expiresIn: SESSION_EXPIRES_IN_SECONDS,
			updateAge: SESSION_UPDATE_AGE_SECONDS
		},
		rateLimit: {
			enabled: false
		},
		databaseHooks: {
			session: {
				create: {
					before: async (session) => {
						if (isInactiveUser(config.db, session.userId)) {
							return false;
						}
					}
				}
			}
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path === BACKUP_CODE_PATH) {
					const body = backupCodeBodySchema.safeParse(ctx.body);

					if (body.success) {
						return { context: { body: { code: hashBackupCode(body.data.code) } } };
					}

					return;
				}

				if (NEW_PASSWORD_PATHS.has(ctx.path)) {
					const body = newPasswordBodySchema.safeParse(ctx.body);

					if (
						body.success &&
						findPasswordPolicyViolation(body.data.newPassword) !== null
					) {
						throw new APIError('BAD_REQUEST', {
							code: 'PASSWORD_POLICY_VIOLATION',
							message: 'The new password does not meet the password policy'
						});
					}
				}
			})
		},
		plugins: [
			twoFactor({
				issuer: config.appName,
				backupCodeOptions: {
					customBackupCodesGenerate: generateBackupCodes,
					storeBackupCodes: backupCodeStorage
				}
			}),
			twoFactorChallenge(),
			requestCookies(config.cookies)
		]
	});
}

export type Auth = ReturnType<typeof createAuth>;

export type AuthSessionData = Auth['$Infer']['Session'];

export type AuthUser = AuthSessionData['user'];

export type AuthSession = AuthSessionData['session'];

function writeAuthLog(
	logger: Logger,
	level: 'debug' | 'info' | 'warn' | 'error',
	message: string
): void {
	logger[level]({ component: 'better-auth' }, message);
}

function isInactiveUser(db: AppDatabase, userId: string): boolean {
	const row = db
		.select({ deactivatedAt: schema.user.deactivatedAt })
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.get();

	if (!row) {
		return true;
	}

	return row.deactivatedAt !== null;
}
