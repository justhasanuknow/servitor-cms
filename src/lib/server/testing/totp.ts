import { createHmac } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const PERIOD_SECONDS = 30;

const DIGITS = 6;

export function generateTotp(base32Secret: string, timestamp: number = Date.now()): string {
	const counter = Math.floor(timestamp / 1000 / PERIOD_SECONDS);
	const message = Buffer.alloc(8);

	message.writeBigUInt64BE(BigInt(counter));

	const digest = createHmac('sha1', decodeBase32(base32Secret)).update(message).digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const binary = digest.readUInt32BE(offset) & 0x7fffffff;

	return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function nextTotp(base32Secret: string): string {
	return generateTotp(base32Secret, Date.now() + PERIOD_SECONDS * 1000);
}

export function secretFromTotpUri(totpUri: string): string {
	const secret = new URL(totpUri).searchParams.get('secret');

	if (secret === null) {
		throw new Error('The TOTP URI has no secret');
	}

	return secret;
}

function decodeBase32(value: string): Buffer {
	const bytes: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (const character of value.replace(/=+$/, '').toUpperCase()) {
		const index = BASE32_ALPHABET.indexOf(character);

		if (index === -1) {
			throw new Error('The secret is not valid base32');
		}

		buffer = (buffer << 5) | index;
		bits += 5;

		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}

	return Buffer.from(bytes);
}
