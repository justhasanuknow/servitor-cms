import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { verifyPassword as verifyLegacyPassword } from 'better-auth/crypto';
import type { ScryptParameters } from './password-hash.interfaces';

export const PASSWORD_HASH_PARAMETERS: ScryptParameters = { logN: 15, r: 8, p: 3 };

const KEY_LENGTH = 64;

const SALT_LENGTH = 16;

const MAX_MEMORY_BYTES = 256 * 1024 * 1024;

const HASH_PATTERN =
	/^\$scrypt\$ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

const LEGACY_HASH_PATTERN = /^[0-9a-f]+:[0-9a-f]+$/;

const PARAMETER_LIMITS = {
	logN: { min: 10, max: 20 },
	r: { min: 1, max: 32 },
	p: { min: 1, max: 16 }
} as const;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const key = await deriveKey(password, salt, PASSWORD_HASH_PARAMETERS, KEY_LENGTH);

	return formatHash(PASSWORD_HASH_PARAMETERS, salt, key);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
	const match = HASH_PATTERN.exec(hash);

	if (match === null) {
		return verifyLegacyHash(hash, password);
	}

	const parameters: ScryptParameters = {
		logN: Number(match[1]),
		r: Number(match[2]),
		p: Number(match[3])
	};

	if (!withinLimits(parameters)) {
		return false;
	}

	const expected = Buffer.from(match[5], 'base64');
	const actual = await deriveKey(
		password,
		Buffer.from(match[4], 'base64'),
		parameters,
		expected.length
	);

	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function verifyLegacyHash(hash: string, password: string): Promise<boolean> {
	if (!LEGACY_HASH_PATTERN.test(hash)) {
		return false;
	}

	return verifyLegacyPassword({ hash, password });
}

export function passwordHashNeedsUpgrade(hash: string): boolean {
	return !hash.startsWith(`${parameterPrefix(PASSWORD_HASH_PARAMETERS)}$`);
}

function deriveKey(
	password: string,
	salt: Buffer,
	parameters: ScryptParameters,
	keyLength: number
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password.normalize('NFKC'),
			salt,
			keyLength,
			{ N: 2 ** parameters.logN, r: parameters.r, p: parameters.p, maxmem: MAX_MEMORY_BYTES },
			(error, key) => {
				if (error) {
					reject(error);
				} else {
					resolve(key);
				}
			}
		);
	});
}

function formatHash(parameters: ScryptParameters, salt: Buffer, key: Buffer): string {
	return [parameterPrefix(parameters), unpadded(salt), unpadded(key)].join('$');
}

function parameterPrefix(parameters: ScryptParameters): string {
	return `$scrypt$ln=${parameters.logN},r=${parameters.r},p=${parameters.p}`;
}

function unpadded(value: Buffer): string {
	return value.toString('base64').replace(/=+$/, '');
}

function withinLimits(parameters: ScryptParameters): boolean {
	return (Object.keys(PARAMETER_LIMITS) as (keyof ScryptParameters)[]).every(
		(name) =>
			parameters[name] >= PARAMETER_LIMITS[name].min &&
			parameters[name] <= PARAMETER_LIMITS[name].max
	);
}
