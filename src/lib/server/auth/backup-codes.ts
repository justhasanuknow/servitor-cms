import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

const HASH_PREFIX = 'sha256:';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

export const BACKUP_CODE_COUNT = 10;

export const BACKUP_CODE_GROUPS = 4;

export const BACKUP_CODE_GROUP_LENGTH = 6;

export const BACKUP_CODE_ENTROPY_BITS =
	BACKUP_CODE_GROUPS * BACKUP_CODE_GROUP_LENGTH * Math.log2(ALPHABET.length);

const storedCodesSchema = z.array(z.string());

export function generateBackupCodes(): string[] {
	return Array.from({ length: BACKUP_CODE_COUNT }, () => {
		const bytes = randomBytes(BACKUP_CODE_GROUPS * BACKUP_CODE_GROUP_LENGTH);

		return formatBackupCode(
			Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
		);
	});
}

export function normalizeBackupCode(code: string): string {
	return formatBackupCode(code.replace(/[\s-]+/g, '').toLowerCase());
}

export function hashBackupCode(code: string): string {
	const digest = createHash('sha256').update(normalizeBackupCode(code)).digest('hex');

	return `${HASH_PREFIX}${digest}`;
}

export const backupCodeStorage = {
	encrypt: async (serializedCodes: string): Promise<string> => {
		const codes = storedCodesSchema.parse(JSON.parse(serializedCodes));

		return JSON.stringify(codes.map(protect));
	},
	decrypt: async (storedCodes: string): Promise<string> => storedCodes
};

function protect(code: string): string {
	if (code.startsWith(HASH_PREFIX)) {
		return code;
	}

	return hashBackupCode(code);
}

function formatBackupCode(compact: string): string {
	const groups: string[] = [];

	for (let start = 0; start < compact.length; start += BACKUP_CODE_GROUP_LENGTH) {
		groups.push(compact.slice(start, start + BACKUP_CODE_GROUP_LENGTH));
	}

	return groups.join('-');
}
