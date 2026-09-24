import { describe, expect, it } from 'vitest';
import { createBackupCodeProtector, normalizeBackupCode } from './backup-codes';

const SECRET = 'x'.repeat(40);

describe('normalizeBackupCode', () => {
	it('keeps codes in the generated format', () => {
		expect(normalizeBackupCode('aB3dE-fG5hJ')).toBe('aB3dE-fG5hJ');
	});

	it('removes whitespace and restores the separator', () => {
		expect(normalizeBackupCode(' aB3dE fG5hJ ')).toBe('aB3dE-fG5hJ');
		expect(normalizeBackupCode('aB3dEfG5hJ')).toBe('aB3dE-fG5hJ');
	});
});

describe('createBackupCodeProtector', () => {
	it('hashes codes deterministically without exposing them', () => {
		const protector = createBackupCodeProtector(SECRET);
		const hashed = protector.hash('aB3dE-fG5hJ');

		expect(hashed).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
		expect(hashed).not.toContain('aB3dE');
		expect(protector.hash('aB3dEfG5hJ')).toBe(hashed);
	});

	it('uses the secret as key material', () => {
		const first = createBackupCodeProtector(SECRET).hash('aB3dE-fG5hJ');
		const second = createBackupCodeProtector('y'.repeat(40)).hash('aB3dE-fG5hJ');

		expect(first).not.toBe(second);
	});

	it('stores only hashes and keeps already hashed codes unchanged', async () => {
		const protector = createBackupCodeProtector(SECRET);
		const stored = await protector.storage.encrypt(
			JSON.stringify(['aB3dE-fG5hJ', 'kL7mN-pQ9rS'])
		);
		const codes: unknown = JSON.parse(stored);

		expect(codes).toEqual([protector.hash('aB3dE-fG5hJ'), protector.hash('kL7mN-pQ9rS')]);
		expect(await protector.storage.encrypt(stored)).toBe(stored);
		expect(await protector.storage.decrypt(stored)).toBe(stored);
	});

	it('hashes a submitted stored hash again so it never matches', () => {
		const protector = createBackupCodeProtector(SECRET);
		const stored = protector.hash('aB3dE-fG5hJ');

		expect(protector.hash(stored)).not.toBe(stored);
	});
});
