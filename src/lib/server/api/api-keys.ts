import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import {
	API_KEY_BYTES,
	API_KEY_LAST_USED_RESOLUTION_MS,
	API_KEY_MAX_LENGTH,
	API_KEY_PREFIX,
	API_KEY_VISIBLE_CHARACTERS
} from '../../constants/api';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import { reauthenticate } from '../auth/reauthentication';
import type { ReauthenticationInput } from '../auth/reauthentication.interfaces';
import type { DatabaseExecutor } from '../db';
import {
	apiKeyCategories,
	apiKeyLanguages,
	apiKeys,
	categories,
	contentLanguages,
	user
} from '../db/schema';
import { requirePermission } from '../permissions/permissions';
import type { Runtime } from '../runtime.interfaces';
import type {
	ApiKeyContext,
	ApiKeyCreateResult,
	ApiKeyInput,
	ApiKeyRevokeResult,
	ApiKeyStatus,
	ApiKeyView
} from './api-keys.interfaces';

export function generateApiKey(): string {
	return `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString('base64url')}`;
}

export function apiKeyPrefix(key: string): string {
	return key.slice(0, API_KEY_PREFIX.length + API_KEY_VISIBLE_CHARACTERS);
}

export function hashApiKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	input: ApiKeyInput,
	confirmation: ReauthenticationInput,
	now: Date = new Date()
): Promise<ApiKeyCreateResult> {
	requirePermission(actor, 'api_key.manage', null);

	const verified = await reauthenticate(runtime, request, actor, confirmation);

	if (verified !== 'verified') {
		return { status: verified };
	}

	const { db } = runtime;

	if (input.expiresAt !== null && input.expiresAt.getTime() <= now.getTime()) {
		return { status: 'invalid_expiry' };
	}

	if (input.languages !== null && !allExist(db, 'languages', input.languages)) {
		return { status: 'unknown_language' };
	}

	if (input.categories !== null && !allExist(db, 'categories', input.categories)) {
		return { status: 'unknown_category' };
	}

	const key = generateApiKey();
	const id = crypto.randomUUID();
	const prefix = apiKeyPrefix(key);

	db.transaction((tx) => {
		tx.insert(apiKeys)
			.values({
				id,
				name: input.name,
				keyPrefix: prefix,
				keyHash: hashApiKey(key),
				allLanguages: input.languages === null,
				allCategories: input.categories === null,
				rateLimitPerMinute: input.rateLimitPerMinute,
				expiresAt: input.expiresAt,
				createdBy: actor.id,
				createdAt: now
			})
			.run();

		for (const languageCode of input.languages ?? []) {
			tx.insert(apiKeyLanguages).values({ apiKeyId: id, languageCode }).run();
		}

		for (const categoryId of input.categories ?? []) {
			tx.insert(apiKeyCategories).values({ apiKeyId: id, categoryId }).run();
		}

		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'api_key.created',
			targetType: 'api_key',
			targetId: id,
			details: {
				name: input.name,
				prefix,
				languages: input.languages,
				categories: input.categories,
				expiresAt: input.expiresAt?.toISOString() ?? null,
				rateLimitPerMinute: input.rateLimitPerMinute
			},
			ip: request.ip,
			userAgent: request.userAgent
		});
	});

	return { status: 'created', id, key };
}

export async function revokeApiKey(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string,
	confirmation: ReauthenticationInput,
	now: Date = new Date()
): Promise<ApiKeyRevokeResult> {
	requirePermission(actor, 'api_key.manage', null);

	const verified = await reauthenticate(runtime, request, actor, confirmation);

	if (verified !== 'verified') {
		return verified;
	}

	return runtime.db.transaction((tx): ApiKeyRevokeResult => {
		const key = tx
			.select({ name: apiKeys.name, prefix: apiKeys.keyPrefix, revokedAt: apiKeys.revokedAt })
			.from(apiKeys)
			.where(eq(apiKeys.id, id))
			.get();

		if (key === undefined) {
			return 'not_found';
		}

		if (key.revokedAt !== null) {
			return 'already_revoked';
		}

		tx.update(apiKeys).set({ revokedAt: now }).where(eq(apiKeys.id, id)).run();
		recordAuditEntry(tx, {
			actorType: 'user',
			actorId: actor.id,
			action: 'api_key.revoked',
			targetType: 'api_key',
			targetId: id,
			details: { name: key.name, prefix: key.prefix },
			ip: request.ip,
			userAgent: request.userAgent
		});

		return 'revoked';
	});
}

export function listApiKeys(db: DatabaseExecutor, now: Date = new Date()): ApiKeyView[] {
	const rows = db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			prefix: apiKeys.keyPrefix,
			allLanguages: apiKeys.allLanguages,
			allCategories: apiKeys.allCategories,
			rateLimitPerMinute: apiKeys.rateLimitPerMinute,
			expiresAt: apiKeys.expiresAt,
			lastUsedAt: apiKeys.lastUsedAt,
			revokedAt: apiKeys.revokedAt,
			createdAt: apiKeys.createdAt,
			createdByName: user.name
		})
		.from(apiKeys)
		.innerJoin(user, eq(user.id, apiKeys.createdBy))
		.orderBy(desc(apiKeys.createdAt))
		.all();
	const scopes = keyScopes(
		db,
		rows.map((row) => row.id)
	);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		prefix: row.prefix,
		status: keyStatus(row.revokedAt, row.expiresAt, now),
		languages: scopeList(row.allLanguages, scopes.languages.get(row.id)),
		categories: scopeList(row.allCategories, scopes.categories.get(row.id)),
		rateLimitPerMinute: row.rateLimitPerMinute,
		expiresAt: row.expiresAt,
		lastUsedAt: row.lastUsedAt,
		revokedAt: row.revokedAt,
		createdAt: row.createdAt,
		createdByName: row.createdByName
	}));
}

export function authenticateApiKey(
	db: DatabaseExecutor,
	presented: string,
	now: Date = new Date()
): ApiKeyContext | null {
	if (!presented.startsWith(API_KEY_PREFIX) || presented.length > API_KEY_MAX_LENGTH) {
		return null;
	}

	const presentedHash = Buffer.from(hashApiKey(presented), 'hex');
	let match: typeof apiKeys.$inferSelect | null = null;

	for (const candidate of db
		.select()
		.from(apiKeys)
		.where(eq(apiKeys.keyPrefix, apiKeyPrefix(presented)))
		.all()) {
		const storedHash = Buffer.from(candidate.keyHash, 'hex');

		if (
			storedHash.length === presentedHash.length &&
			timingSafeEqual(storedHash, presentedHash)
		) {
			match = candidate;
		}
	}

	if (match === null || keyStatus(match.revokedAt, match.expiresAt, now) !== 'active') {
		return null;
	}

	touchKey(db, match.id, now);

	const scopes = keyScopes(db, [match.id]);

	return {
		id: match.id,
		rateLimitPerMinute: match.rateLimitPerMinute,
		languages: scopeList(match.allLanguages, scopes.languages.get(match.id)),
		categories: scopeList(match.allCategories, scopes.categories.get(match.id))
	};
}

function touchKey(db: DatabaseExecutor, id: string, now: Date): void {
	db.update(apiKeys)
		.set({ lastUsedAt: now })
		.where(
			and(
				eq(apiKeys.id, id),
				or(
					isNull(apiKeys.lastUsedAt),
					lt(
						apiKeys.lastUsedAt,
						new Date(now.getTime() - API_KEY_LAST_USED_RESOLUTION_MS)
					)
				)
			)
		)
		.run();
}

function keyStatus(revokedAt: Date | null, expiresAt: Date | null, now: Date): ApiKeyStatus {
	if (revokedAt !== null) {
		return 'revoked';
	}

	if (expiresAt !== null && expiresAt.getTime() <= now.getTime()) {
		return 'expired';
	}

	return 'active';
}

function keyScopes(db: DatabaseExecutor, ids: string[]) {
	const languages = new Map<string, string[]>();
	const categoryScopes = new Map<string, string[]>();

	if (ids.length === 0) {
		return { languages, categories: categoryScopes };
	}

	for (const row of db
		.select()
		.from(apiKeyLanguages)
		.where(inArray(apiKeyLanguages.apiKeyId, ids))
		.all()) {
		languages.set(row.apiKeyId, [...(languages.get(row.apiKeyId) ?? []), row.languageCode]);
	}

	for (const row of db
		.select()
		.from(apiKeyCategories)
		.where(inArray(apiKeyCategories.apiKeyId, ids))
		.all()) {
		categoryScopes.set(row.apiKeyId, [
			...(categoryScopes.get(row.apiKeyId) ?? []),
			row.categoryId
		]);
	}

	return { languages, categories: categoryScopes };
}

function scopeList(all: boolean, entries: string[] | undefined): string[] | null {
	if (all) {
		return null;
	}

	return [...(entries ?? [])].sort();
}

function allExist(
	db: DatabaseExecutor,
	kind: 'languages' | 'categories',
	values: string[]
): boolean {
	if (values.length === 0) {
		return false;
	}

	const unique = [...new Set(values)];

	if (kind === 'languages') {
		return (
			db
				.select({ code: contentLanguages.code })
				.from(contentLanguages)
				.where(inArray(contentLanguages.code, unique))
				.all().length === unique.length
		);
	}

	return (
		db
			.select({ id: categories.id })
			.from(categories)
			.where(inArray(categories.id, unique))
			.all().length === unique.length
	);
}
