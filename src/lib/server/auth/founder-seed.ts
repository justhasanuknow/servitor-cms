import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import { z } from 'zod';
import { recordAuditEntry } from '../audit/audit-log';
import { describeIssue, EnvValidationError, type Env } from '../config/env';
import type { AppDatabase } from '../db';
import { account, user, userProfiles } from '../db/schema';
import type { FounderSeed } from './founder-seed.interfaces';
import { findPasswordPolicyViolation, type PasswordPolicyViolation } from './password-policy';

const emailAddress = z.email();

const founderSeedSchema = z.object({
	FOUNDER_EMAIL: z
		.string({ error: 'is required to create the founder account' })
		.trim()
		.toLowerCase()
		.max(254)
		.refine((value) => emailAddress.safeParse(value).success, 'must be a valid email address'),
	FOUNDER_NAME: z
		.string({ error: 'is required to create the founder account' })
		.trim()
		.min(1, 'is required to create the founder account')
		.max(100),
	FOUNDER_PASSWORD: z.string({ error: 'is required to create the founder account' })
});

const POLICY_MESSAGES: Record<PasswordPolicyViolation, string> = {
	too_short: 'must be at least 12 characters long',
	too_long: 'must be at most 128 characters long',
	too_common: 'is too common, choose a less predictable password'
};

export async function ensureFounder(db: AppDatabase, env: Env, logger: Logger): Promise<void> {
	const existing = db.select({ id: user.id }).from(user).where(eq(user.role, 'founder')).get();

	if (existing) {
		return;
	}

	const seed = parseFounderSeed(env);
	const passwordHash = await hashPassword(seed.password);
	const founderId = crypto.randomUUID();
	const now = new Date();

	db.transaction((tx) => {
		tx.insert(user)
			.values({
				id: founderId,
				name: seed.name,
				email: seed.email,
				role: 'founder',
				mustChangePassword: true
			})
			.run();
		tx.insert(account)
			.values({
				id: crypto.randomUUID(),
				accountId: founderId,
				providerId: 'credential',
				userId: founderId,
				password: passwordHash,
				updatedAt: now
			})
			.run();
		tx.insert(userProfiles).values({ userId: founderId }).run();
		recordAuditEntry(tx, {
			actorType: 'system',
			action: 'user.created',
			targetType: 'user',
			targetId: founderId,
			details: { role: 'founder', source: 'environment' }
		});
	});

	logger.info({ userId: founderId }, 'Founder account created from the environment');
}

function parseFounderSeed(env: Env): FounderSeed {
	const result = founderSeedSchema.safeParse({
		FOUNDER_EMAIL: env.FOUNDER_EMAIL,
		FOUNDER_NAME: env.FOUNDER_NAME,
		FOUNDER_PASSWORD: env.FOUNDER_PASSWORD
	});

	if (!result.success) {
		throw new EnvValidationError(result.error.issues.map(describeIssue));
	}

	const violation = findPasswordPolicyViolation(result.data.FOUNDER_PASSWORD);

	if (violation !== null) {
		throw new EnvValidationError([`FOUNDER_PASSWORD: ${POLICY_MESSAGES[violation]}`]);
	}

	return {
		email: result.data.FOUNDER_EMAIL,
		name: result.data.FOUNDER_NAME,
		password: result.data.FOUNDER_PASSWORD
	};
}
