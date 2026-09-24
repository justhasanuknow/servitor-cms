import { describe, expect, it } from 'vitest';
import {
	BACKUP_CODE_COUNT,
	BACKUP_CODE_ENTROPY_BITS,
	backupCodeStorage,
	generateBackupCodes,
	hashBackupCode,
	normalizeBackupCode
} from './backup-codes';

const CODE = 'abcdef-ghijk2-mnop34-qrst56';

describe('generateBackupCodes', () => {
	it('creates ten distinct codes in four groups of six base32 characters', () => {
		const codes = generateBackupCodes();

		expect(codes).toHaveLength(BACKUP_CODE_COUNT);
		expect(new Set(codes).size).toBe(BACKUP_CODE_COUNT);

		for (const code of codes) {
			expect(code).toMatch(/^[a-z2-7]{6}-[a-z2-7]{6}-[a-z2-7]{6}-[a-z2-7]{6}$/);
		}
	});

	it('gives every code at least 112 bits of entropy', () => {
		expect(BACKUP_CODE_ENTROPY_BITS).toBeGreaterThanOrEqual(112);
	});
});

describe('normalizeBackupCode', () => {
	it('keeps codes in the generated format', () => {
		expect(normalizeBackupCode(CODE)).toBe(CODE);
	});

	it('ignores letter case, spaces and missing separators', () => {
		expect(normalizeBackupCode(' ABCDEF ghijk2 MNOP34 qrst56 ')).toBe(CODE);
		expect(normalizeBackupCode('abcdefghijk2mnop34qrst56')).toBe(CODE);
		expect(normalizeBackupCode('abc-defghijk2-mnop34qrst-56')).toBe(CODE);
	});
});

describe('hashBackupCode', () => {
	it('hashes codes deterministically without exposing them', () => {
		const hashed = hashBackupCode(CODE);

		expect(hashed).toMatch(/^sha256:[0-9a-f]{64}$/);
		expect(hashed).not.toContain('abcdef');
		expect(hashBackupCode('ABCDEFGHIJK2MNOP34QRST56')).toBe(hashed);
	});

	it('hashes a submitted stored hash again so it never matches', () => {
		const stored = hashBackupCode(CODE);

		expect(hashBackupCode(stored)).not.toBe(stored);
	});
});

describe('backupCodeStorage', () => {
	it('stores only hashes and keeps already hashed codes unchanged', async () => {
		const [first, second] = generateBackupCodes();
		const stored = await backupCodeStorage.encrypt(JSON.stringify([first, second]));
		const codes: unknown = JSON.parse(stored);

		expect(codes).toEqual([hashBackupCode(first), hashBackupCode(second)]);
		expect(await backupCodeStorage.encrypt(stored)).toBe(stored);
		expect(await backupCodeStorage.decrypt(stored)).toBe(stored);
	});
});
