import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, sealedWithCurrentKey } from './secret-box';

const OLD_SECRET = 'o'.repeat(40);

const NEW_SECRET = 'n'.repeat(40);

function legacySealed(plaintext: string, masterSecret: string): string {
	const key = Buffer.from(
		hkdfSync(
			'sha256',
			masterSecret,
			'servitor-webhook-secrets',
			'webhook-secret-encryption-v1',
			32
		)
	);
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

	return [
		'v1',
		iv.toString('base64url'),
		cipher.getAuthTag().toString('base64url'),
		ciphertext.toString('base64url')
	].join('.');
}

describe('secret box', () => {
	it('round-trips a secret with the current key and names that key', () => {
		const keys = { current: NEW_SECRET, previous: [] };
		const sealed = encryptSecret('whsec_value', keys);

		expect(sealed.startsWith('v2.')).toBe(true);
		expect(sealed).not.toContain('whsec_value');
		expect(decryptSecret(sealed, keys)).toBe('whsec_value');
		expect(sealedWithCurrentKey(sealed, keys)).toBe(true);
	});

	it('opens values sealed with a previous key only while that key is configured', () => {
		const sealed = encryptSecret('whsec_value', { current: OLD_SECRET, previous: [] });
		const rotated = { current: NEW_SECRET, previous: [OLD_SECRET] };

		expect(decryptSecret(sealed, rotated)).toBe('whsec_value');
		expect(sealedWithCurrentKey(sealed, rotated)).toBe(false);
		expect(decryptSecret(sealed, { current: NEW_SECRET, previous: [] })).toBeNull();
	});

	it('still opens values in the first format with any configured key', () => {
		const sealed = legacySealed('whsec_value', OLD_SECRET);

		expect(decryptSecret(sealed, { current: NEW_SECRET, previous: [OLD_SECRET] })).toBe(
			'whsec_value'
		);
		expect(sealedWithCurrentKey(sealed, { current: OLD_SECRET, previous: [] })).toBe(false);
	});

	it('rejects tampered or malformed values', () => {
		const keys = { current: NEW_SECRET, previous: [] };
		const parts = encryptSecret('whsec_value', keys).split('.');

		parts[4] = Buffer.from('tampered').toString('base64url');

		expect(decryptSecret(parts.join('.'), keys)).toBeNull();
		expect(decryptSecret('v2.1.2', keys)).toBeNull();
		expect(decryptSecret('plain', keys)).toBeNull();
	});
});
