import { createHmac, hkdfSync } from 'node:crypto';
import { z } from 'zod';

const HASH_PREFIX = 'hmac-sha256:';

const KEY_INFO = 'servitor-backup-codes';

const BACKUP_CODE_LENGTH = 10;

const storedCodesSchema = z.array(z.string());

export function normalizeBackupCode(code: string): string {
	const compact = code.replace(/\s+/g, '');

	if (compact.length === BACKUP_CODE_LENGTH && !compact.includes('-')) {
		return `${compact.slice(0, BACKUP_CODE_LENGTH / 2)}-${compact.slice(BACKUP_CODE_LENGTH / 2)}`;
	}

	return compact;
}

export function createBackupCodeProtector(secret: string) {
	const key = Buffer.from(hkdfSync('sha256', secret, '', KEY_INFO, 32));

	function hash(code: string): string {
		const digest = createHmac('sha256', key).update(normalizeBackupCode(code)).digest('hex');

		return `${HASH_PREFIX}${digest}`;
	}

	function protect(code: string): string {
		if (code.startsWith(HASH_PREFIX)) {
			return code;
		}

		return hash(code);
	}

	return {
		hash,
		storage: {
			encrypt: async (serializedCodes: string): Promise<string> => {
				const codes = storedCodesSchema.parse(JSON.parse(serializedCodes));

				return JSON.stringify(codes.map(protect));
			},
			decrypt: async (storedCodes: string): Promise<string> => storedCodes
		}
	};
}
