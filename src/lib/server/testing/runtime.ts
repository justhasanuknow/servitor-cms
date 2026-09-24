import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { createAuth } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { authRequestHeaders } from '../auth/auth-request';
import { LoginLockout } from '../auth/login-lockout';
import { hashPassword } from '../auth/password-hash';
import { TotpReplayGuard } from '../auth/totp-replay';
import { signInWithPassword } from '../auth/sign-in';
import { parseEnv } from '../config/env';
import { account, user, userProfiles } from '../db/schema';
import { createLogger } from '../logging/logger';
import { MediaStore } from '../media/media-store';
import type { EmailMessage } from '../email/mailer.interfaces';
import type { Runtime } from '../runtime.interfaces';
import { RateLimiter } from '../security/rate-limiter';
import { secretKeys } from '../security/secret-keys';
import { TestCookieJar } from './cookie-jar';
import { createTestDatabase } from './database';
import type { TestRuntimeOptions, TestUserInput } from './runtime.interfaces';

export const TEST_ORIGIN = 'http://localhost:4173';

export const TEST_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export function createTestRuntime(options: TestRuntimeOptions = {}) {
	const database = createTestDatabase();
	const emails: EmailMessage[] = [];
	const uploadsDir = join('.tmp', 'tests', `uploads-${crypto.randomUUID()}`);
	const origin = options.origin ?? TEST_ORIGIN;
	const env = parseEnv({
		ORIGIN: origin,
		BETTER_AUTH_SECRET: 'test-only-secret-that-never-leaves-the-test-suite',
		DATABASE_PATH: database.path,
		UPLOADS_DIR: uploadsDir,
		LOG_LEVEL: 'silent'
	});
	const media = new MediaStore(uploadsDir);
	const logger = createLogger('silent');
	let activeJar: TestCookieJar | undefined;
	let clockOffset = 0;
	const now = () => Date.now() + clockOffset;
	const auth = createAuth({
		db: database.db,
		origin: env.ORIGIN,
		keys: secretKeys(env),
		appName: 'localhost',
		logger,
		cookies: () => activeJar
	});
	const runtime: Runtime = {
		env,
		logger,
		db: database.db,
		auth,
		rateLimiter: new RateLimiter(now),
		loginLockout: new LoginLockout(now),
		totpReplay: new TotpReplayGuard(now),
		media,
		mailer: {
			enabled: options.mail === true,
			send: async (message) => {
				if (options.mail !== true) {
					throw new Error('Email is not configured');
				}

				emails.push(message);
			}
		}
	};

	media.prepare();

	function dispose(): void {
		database.dispose();
		rmSync(uploadsDir, { recursive: true, force: true });
	}

	function advanceClock(milliseconds: number): void {
		clockOffset += milliseconds;
	}

	function request(jar: TestCookieJar, ip = '198.51.100.1'): AuthRequest {
		const headers = new Headers({ 'user-agent': TEST_USER_AGENT, origin });
		const cookie = jar.header();

		activeJar = jar;

		if (cookie !== '') {
			headers.set('cookie', cookie);
		}

		return {
			headers: authRequestHeaders(headers, ip, origin.startsWith('https:')),
			ip,
			userAgent: TEST_USER_AGENT
		};
	}

	async function createUser(input: TestUserInput): Promise<string> {
		const id = crypto.randomUUID();
		const now = new Date();
		const passwordHash = await hashPassword(input.password);

		database.db.transaction((tx) => {
			tx.insert(user)
				.values({
					id,
					name: input.name ?? 'Test User',
					email: input.email,
					role: input.role ?? 'author',
					mustChangePassword: input.mustChangePassword ?? false
				})
				.run();
			tx.insert(account)
				.values({
					id: crypto.randomUUID(),
					accountId: id,
					providerId: 'credential',
					userId: id,
					password: passwordHash,
					updatedAt: now
				})
				.run();
			tx.insert(userProfiles).values({ userId: id }).run();
		});

		return id;
	}

	async function currentSession(jar: TestCookieJar) {
		const current = await auth.api.getSession({ headers: request(jar).headers });

		if (current === null) {
			throw new Error('Expected an active session');
		}

		return current;
	}

	let signInCount = 0;

	async function signIn(email: string, password: string) {
		const jar = new TestCookieJar();

		signInCount += 1;

		const result = await signInWithPassword(runtime, request(jar, `203.0.113.${signInCount}`), {
			email,
			password
		});

		if (result.status !== 'signed_in') {
			throw new Error(`Expected a successful sign-in, got ${result.status}`);
		}

		const current = await currentSession(jar);

		return { jar, actor: current.user, sessionId: current.session.id };
	}

	return {
		runtime,
		emails,
		request,
		createUser,
		currentSession,
		signIn,
		advanceClock,
		dispose
	};
}
