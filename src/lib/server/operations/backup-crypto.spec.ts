import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	decryptBackupFile,
	encryptingStream,
	isEncryptedBackup,
	parseEncryptionHeader,
	passphraseProblem
} from './backup-crypto';

const PASSPHRASE = 'correct horse battery staple';

let root: string;

beforeEach(() => {
	root = resolve('.tmp', 'tests', `backup-crypto-${crypto.randomUUID()}`);
	mkdirSync(root, { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

async function encrypt(plain: Buffer, passphrase = PASSPHRASE): Promise<string> {
	const path = join(root, `${crypto.randomUUID()}.enc`);

	await pipeline(
		Readable.from([plain]),
		await encryptingStream(passphrase),
		createWriteStream(path)
	);

	return path;
}

function headerEnd(file: Buffer): number {
	return file.indexOf(0x0a, file.indexOf(0x0a) + 1) + 1;
}

describe('backup encryption', () => {
	it.each([
		['an empty file', 0],
		['a small file', 100],
		['exactly one chunk', 64 * 1024],
		['several chunks', 200 * 1024 + 7]
	])('restores %s exactly', async (_name, size) => {
		const plain = randomBytes(size);
		const encrypted = await encrypt(plain);
		const output = join(root, 'plain.tar.gz');

		expect(readFileSync(encrypted).includes(plain.subarray(0, 32))).toBe(size < 32);
		expect(await isEncryptedBackup(encrypted)).toBe(true);
		expect(await decryptBackupFile(encrypted, output, PASSPHRASE)).toBe('decrypted');
		expect(readFileSync(output).equals(plain)).toBe(true);
	});

	it('reports a wrong passphrase and leaves no output behind', async () => {
		const encrypted = await encrypt(randomBytes(1000));
		const output = join(root, 'wrong.tar.gz');

		expect(await decryptBackupFile(encrypted, output, 'another long passphrase')).toBe(
			'wrong_passphrase'
		);
		expect(() => readFileSync(output)).toThrow();
	});

	it('detects a changed byte, a missing end and a changed header', async () => {
		const encrypted = readFileSync(await encrypt(randomBytes(150 * 1024)));
		const tampered = Buffer.from(encrypted);
		const start = headerEnd(encrypted);

		tampered[start + 70 * 1024] ^= 0x01;

		const truncated = encrypted.subarray(0, encrypted.length - 100);
		const header = encrypted.subarray(0, start).toString('utf8');
		const otherSalt = Buffer.concat([
			Buffer.from(
				header.replace(/"salt":"[^"]+"/, `"salt":"${randomBytes(16).toString('base64')}"`)
			),
			encrypted.subarray(start)
		]);

		for (const [name, bytes, expected] of [
			['tampered', tampered, 'invalid'],
			['truncated', truncated, 'invalid'],
			['salt', otherSalt, 'wrong_passphrase']
		] as const) {
			const path = join(root, `${name}.enc`);

			writeFileSync(path, bytes);

			expect(await decryptBackupFile(path, join(root, `${name}.out`), PASSPHRASE)).toBe(
				expected
			);
		}
	});

	it('refuses headers with other parameters', () => {
		const valid = {
			kdf: 'scrypt',
			n: 65536,
			r: 8,
			p: 1,
			salt: randomBytes(16).toString('base64'),
			nonce: randomBytes(7).toString('base64'),
			chunk: 65536
		};

		expect(parseEncryptionHeader(JSON.stringify(valid))).toEqual(valid);
		expect(parseEncryptionHeader(JSON.stringify({ ...valid, n: 2 ** 30 }))).toBeNull();
		expect(parseEncryptionHeader(JSON.stringify({ ...valid, chunk: 1 }))).toBeNull();
		expect(parseEncryptionHeader('not json')).toBeNull();
	});

	it('tells plain archives from encrypted ones', async () => {
		const plain = join(root, 'plain.tar.gz');

		writeFileSync(plain, randomBytes(100));

		expect(await isEncryptedBackup(plain)).toBe(false);
		expect(await decryptBackupFile(plain, join(root, 'out'), PASSPHRASE)).toBe('invalid');
	});

	it('asks for passphrases of 12 to 1024 characters', () => {
		expect(passphraseProblem('short')).toBe('too_short');
		expect(passphraseProblem('x'.repeat(1025))).toBe('too_long');
		expect(passphraseProblem(PASSPHRASE)).toBeNull();
	});
});
