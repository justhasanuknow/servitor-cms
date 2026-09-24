import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { UserTokenType } from '../../constants/users';
import type { DatabaseExecutor } from '../db';
import { user, userTokens } from '../db/schema';
import type { ActiveUserToken, IssueTokenInput } from './tokens.interfaces';

const TOKEN_BYTES = 32;

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const TOKEN_LIFETIMES_MS: Record<UserTokenType, number> = {
	invite: 72 * 60 * 60 * 1000,
	password_reset: 30 * 60 * 1000,
	email_change: 24 * 60 * 60 * 1000
};

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function issueUserToken(db: DatabaseExecutor, input: IssueTokenInput): string {
	const token = randomBytes(TOKEN_BYTES).toString('base64url');
	const now = new Date();

	db.update(userTokens)
		.set({ usedAt: now })
		.where(
			and(
				eq(userTokens.userId, input.userId),
				eq(userTokens.type, input.type),
				isNull(userTokens.usedAt)
			)
		)
		.run();
	db.insert(userTokens)
		.values({
			userId: input.userId,
			type: input.type,
			tokenHash: hashToken(token),
			newEmail: input.newEmail ?? null,
			expiresAt: new Date(now.getTime() + TOKEN_LIFETIMES_MS[input.type]),
			createdBy: input.createdBy
		})
		.run();

	return token;
}

export function findActiveUserToken(
	db: DatabaseExecutor,
	type: UserTokenType,
	token: string
): ActiveUserToken | null {
	if (!TOKEN_PATTERN.test(token)) {
		return null;
	}

	const row = db
		.select({
			id: userTokens.id,
			userId: userTokens.userId,
			newEmail: userTokens.newEmail,
			expiresAt: userTokens.expiresAt
		})
		.from(userTokens)
		.innerJoin(user, eq(user.id, userTokens.userId))
		.where(
			and(
				eq(userTokens.tokenHash, hashToken(token)),
				eq(userTokens.type, type),
				isNull(userTokens.usedAt),
				gt(userTokens.expiresAt, new Date()),
				isNull(user.deactivatedAt)
			)
		)
		.get();

	return row ?? null;
}

export function consumeUserToken(db: DatabaseExecutor, tokenId: string): boolean {
	const result = db
		.update(userTokens)
		.set({ usedAt: new Date() })
		.where(and(eq(userTokens.id, tokenId), isNull(userTokens.usedAt)))
		.run();

	return result.changes === 1;
}
