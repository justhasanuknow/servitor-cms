import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { allSecrets, secretVersion } from '../security/secret-keys';
import type { SecretKeys } from '../security/secret-keys.interfaces';

const ALGORITHM = 'aes-256-gcm';

const FORMAT = 'v2';

const LEGACY_FORMAT = 'v1';

const KEY_BYTES = 32;

const IV_BYTES = 12;

const KEY_SALT = 'servitor-webhook-secrets';

const KEY_INFO = 'webhook-secret-encryption-v1';

function encryptionKey(masterSecret: string): Buffer {
	return Buffer.from(hkdfSync('sha256', masterSecret, KEY_SALT, KEY_INFO, KEY_BYTES));
}

export function encryptSecret(plaintext: string, keys: SecretKeys): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, encryptionKey(keys.current), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

	return [
		FORMAT,
		String(secretVersion(keys.current)),
		iv.toString('base64url'),
		cipher.getAuthTag().toString('base64url'),
		ciphertext.toString('base64url')
	].join('.');
}

export function decryptSecret(sealed: string, keys: SecretKeys): string | null {
	const parts = sealed.split('.');

	if (parts[0] === FORMAT && parts.length === 5) {
		const secret = allSecrets(keys).find(
			(candidate) => String(secretVersion(candidate)) === parts[1]
		);

		if (secret === undefined) {
			return null;
		}

		return openSealed(secret, parts[2], parts[3], parts[4]);
	}

	if (parts[0] === LEGACY_FORMAT && parts.length === 4) {
		for (const secret of allSecrets(keys)) {
			const plaintext = openSealed(secret, parts[1], parts[2], parts[3]);

			if (plaintext !== null) {
				return plaintext;
			}
		}
	}

	return null;
}

export function sealedWithCurrentKey(sealed: string, keys: SecretKeys): boolean {
	const [format, version] = sealed.split('.');

	return format === FORMAT && version === String(secretVersion(keys.current));
}

function openSealed(
	masterSecret: string,
	iv: string,
	tag: string,
	ciphertext: string
): string | null {
	try {
		const decipher = createDecipheriv(
			ALGORITHM,
			encryptionKey(masterSecret),
			Buffer.from(iv, 'base64url')
		);

		decipher.setAuthTag(Buffer.from(tag, 'base64url'));

		return Buffer.concat([
			decipher.update(Buffer.from(ciphertext, 'base64url')),
			decipher.final()
		]).toString('utf8');
	} catch {
		return null;
	}
}
