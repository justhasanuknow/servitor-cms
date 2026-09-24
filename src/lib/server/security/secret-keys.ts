import { createHash } from 'node:crypto';
import type { Env } from '../config/env';
import type { SecretKeys, VersionedSecret } from './secret-keys.interfaces';

const VERSION_LABEL = 'servitor-key-version:';

export function secretKeys(
	env: Pick<Env, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_PREVIOUS_SECRETS'>
): SecretKeys {
	return {
		current: env.BETTER_AUTH_SECRET,
		previous: [...new Set(env.BETTER_AUTH_PREVIOUS_SECRETS)].filter(
			(secret) => secret !== env.BETTER_AUTH_SECRET
		)
	};
}

export function allSecrets(keys: SecretKeys): string[] {
	return [keys.current, ...keys.previous];
}

export function secretVersion(secret: string): number {
	return createHash('sha256').update(`${VERSION_LABEL}${secret}`).digest().readUInt32BE(0) >>> 1;
}

export function versionedSecrets(keys: SecretKeys): VersionedSecret[] {
	return allSecrets(keys).map((value) => ({ version: secretVersion(value), value }));
}
