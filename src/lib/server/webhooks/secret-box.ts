import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

const VERSION = 'v1';

const KEY_BYTES = 32;

const IV_BYTES = 12;

const KEY_SALT = 'servitor-webhook-secrets';

const KEY_INFO = 'webhook-secret-encryption-v1';

function encryptionKey(masterSecret: string): Buffer {
	return Buffer.from(hkdfSync('sha256', masterSecret, KEY_SALT, KEY_INFO, KEY_BYTES));
}

export function encryptSecret(plaintext: string, masterSecret: string): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, encryptionKey(masterSecret), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

	return [
		VERSION,
		iv.toString('base64url'),
		cipher.getAuthTag().toString('base64url'),
		ciphertext.toString('base64url')
	].join('.');
}

export function decryptSecret(sealed: string, masterSecret: string): string | null {
	const [version, iv, tag, ciphertext] = sealed.split('.');

	if (version !== VERSION || iv === undefined || tag === undefined || ciphertext === undefined) {
		return null;
	}

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
