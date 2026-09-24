import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scrypt,
	type CipherGCM,
	type DecipherGCM
} from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform, type TransformCallback } from 'node:stream';
import type {
	DecryptionResult,
	EncryptionHeader,
	EncryptionHeaderRead
} from './backup-crypto.interfaces';

const MAGIC = Buffer.from('SERVITOR-BACKUP-ENCRYPTED-1\n', 'ascii');

const CHUNK_BYTES = 64 * 1024;

const TAG_BYTES = 16;

const KEY_BYTES = 32;

const SALT_BYTES = 16;

const NONCE_PREFIX_BYTES = 7;

const MAX_HEADER_BYTES = 1024;

const SCRYPT_COST = 2 ** 16;

const SCRYPT_BLOCK_SIZE = 8;

const SCRYPT_PARALLELISM = 1;

const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;

const ALGORITHM = 'aes-256-gcm';

export const ENCRYPTED_EXTENSION = '.enc';

export const PASSPHRASE_LIMITS = { min: 12, max: 1024 } as const;

export class BackupDecryptionError extends Error {
	constructor(readonly reason: 'wrong_passphrase' | 'invalid') {
		super(reason);
		this.name = 'BackupDecryptionError';
	}
}

export function passphraseProblem(passphrase: string): 'too_short' | 'too_long' | null {
	if (passphrase.length < PASSPHRASE_LIMITS.min) {
		return 'too_short';
	}

	if (passphrase.length > PASSPHRASE_LIMITS.max) {
		return 'too_long';
	}

	return null;
}

function deriveKey(passphrase: string, header: EncryptionHeader): Promise<Buffer> {
	return new Promise((resolveKey, rejectKey) => {
		scrypt(
			passphrase.normalize('NFKC'),
			Buffer.from(header.salt, 'base64'),
			KEY_BYTES,
			{ N: header.n, r: header.r, p: header.p, maxmem: SCRYPT_MAX_MEMORY },
			(error, key) => {
				if (error) {
					rejectKey(error);
				} else {
					resolveKey(key);
				}
			}
		);
	});
}

function headerBytes(header: EncryptionHeader): Buffer {
	return Buffer.concat([MAGIC, Buffer.from(`${JSON.stringify(header)}\n`, 'utf8')]);
}

function nonceFor(prefix: Buffer, counter: number, last: boolean): Buffer {
	const nonce = Buffer.alloc(12);

	prefix.copy(nonce, 0);
	nonce.writeUInt32BE(counter, NONCE_PREFIX_BYTES);
	nonce.writeUInt8(Number(last), NONCE_PREFIX_BYTES + 4);

	return nonce;
}

export async function encryptingStream(passphrase: string): Promise<Transform> {
	const header: EncryptionHeader = {
		kdf: 'scrypt',
		n: SCRYPT_COST,
		r: SCRYPT_BLOCK_SIZE,
		p: SCRYPT_PARALLELISM,
		salt: randomBytes(SALT_BYTES).toString('base64'),
		nonce: randomBytes(NONCE_PREFIX_BYTES).toString('base64'),
		chunk: CHUNK_BYTES
	};
	const key = await deriveKey(passphrase, header);
	const associated = headerBytes(header);
	const prefix = Buffer.from(header.nonce, 'base64');
	let pending = Buffer.alloc(0);
	let counter = 0;

	const seal = (plain: Buffer, last: boolean): Buffer => {
		const cipher: CipherGCM = createCipheriv(ALGORITHM, key, nonceFor(prefix, counter, last));

		cipher.setAAD(associated);
		counter += 1;

		return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
	};

	let started = false;

	return new Transform({
		transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
			if (!started) {
				started = true;
				this.push(associated);
			}

			pending = Buffer.concat([pending, chunk]);

			while (pending.length > CHUNK_BYTES) {
				this.push(seal(pending.subarray(0, CHUNK_BYTES), false));
				pending = pending.subarray(CHUNK_BYTES);
			}

			callback();
		},
		flush(callback: TransformCallback) {
			if (!started) {
				this.push(associated);
			}

			this.push(seal(pending, true));
			callback();
		}
	});
}

export async function isEncryptedBackup(path: string): Promise<boolean> {
	const file = await open(path, 'r');

	try {
		const start = Buffer.alloc(MAGIC.length);
		const { bytesRead } = await file.read(start, 0, MAGIC.length, 0);

		return bytesRead === MAGIC.length && start.equals(MAGIC);
	} finally {
		await file.close();
	}
}

export function parseEncryptionHeader(line: string): EncryptionHeader | null {
	let parsed: unknown;

	try {
		parsed = JSON.parse(line);
	} catch {
		return null;
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!('kdf' in parsed) ||
		parsed.kdf !== 'scrypt' ||
		!('n' in parsed) ||
		parsed.n !== SCRYPT_COST ||
		!('r' in parsed) ||
		parsed.r !== SCRYPT_BLOCK_SIZE ||
		!('p' in parsed) ||
		parsed.p !== SCRYPT_PARALLELISM ||
		!('chunk' in parsed) ||
		parsed.chunk !== CHUNK_BYTES ||
		!('salt' in parsed) ||
		typeof parsed.salt !== 'string' ||
		Buffer.from(parsed.salt, 'base64').length !== SALT_BYTES ||
		!('nonce' in parsed) ||
		typeof parsed.nonce !== 'string' ||
		Buffer.from(parsed.nonce, 'base64').length !== NONCE_PREFIX_BYTES
	) {
		return null;
	}

	return {
		kdf: 'scrypt',
		n: parsed.n,
		r: parsed.r,
		p: parsed.p,
		salt: parsed.salt,
		nonce: parsed.nonce,
		chunk: parsed.chunk
	};
}

async function readHeader(path: string): Promise<EncryptionHeaderRead | null> {
	const file = await open(path, 'r');

	try {
		const start = Buffer.alloc(MAX_HEADER_BYTES);
		const { bytesRead } = await file.read(start, 0, MAX_HEADER_BYTES, 0);
		const bytes = start.subarray(0, bytesRead);

		if (bytes.length < MAGIC.length || !bytes.subarray(0, MAGIC.length).equals(MAGIC)) {
			return null;
		}

		const end = bytes.indexOf(0x0a, MAGIC.length);

		if (end === -1) {
			return null;
		}

		const header = parseEncryptionHeader(bytes.subarray(MAGIC.length, end).toString('utf8'));

		if (header === null) {
			return null;
		}

		return { header, length: end + 1 };
	} finally {
		await file.close();
	}
}

function decryptingStream(key: Buffer, header: EncryptionHeader): Transform {
	const associated = headerBytes(header);
	const prefix = Buffer.from(header.nonce, 'base64');
	const sealedBytes = CHUNK_BYTES + TAG_BYTES;
	let pending = Buffer.alloc(0);
	let counter = 0;

	const openChunk = (sealed: Buffer, last: boolean): Buffer => {
		if (sealed.length < TAG_BYTES) {
			throw new BackupDecryptionError('invalid');
		}

		const decipher: DecipherGCM = createDecipheriv(
			ALGORITHM,
			key,
			nonceFor(prefix, counter, last)
		);

		decipher.setAAD(associated);
		decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));

		try {
			const plain = Buffer.concat([
				decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)),
				decipher.final()
			]);

			counter += 1;

			return plain;
		} catch {
			throw new BackupDecryptionError(failureReason(counter));
		}
	};

	return new Transform({
		transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
			pending = Buffer.concat([pending, chunk]);

			try {
				while (pending.length > sealedBytes) {
					this.push(openChunk(pending.subarray(0, sealedBytes), false));
					pending = pending.subarray(sealedBytes);
				}

				callback();
			} catch (error) {
				callback(asError(error));
			}
		},
		flush(callback: TransformCallback) {
			try {
				this.push(openChunk(pending, true));
				callback();
			} catch (error) {
				callback(asError(error));
			}
		}
	});
}

function failureReason(counter: number): 'wrong_passphrase' | 'invalid' {
	if (counter === 0) {
		return 'wrong_passphrase';
	}

	return 'invalid';
}

function asError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new Error(String(error));
}

export async function decryptBackupFile(
	input: string,
	output: string,
	passphrase: string
): Promise<DecryptionResult> {
	const read = await readHeader(input);

	if (read === null) {
		return 'invalid';
	}

	const key = await deriveKey(passphrase, read.header);

	try {
		await pipeline(
			createReadStream(input, { start: read.length }),
			decryptingStream(key, read.header),
			createWriteStream(output, { flags: 'wx' })
		);

		return 'decrypted';
	} catch (error) {
		await rm(output, { force: true });

		if (error instanceof BackupDecryptionError) {
			return error.reason;
		}

		throw error;
	}
}
