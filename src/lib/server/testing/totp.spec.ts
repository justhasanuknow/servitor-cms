import { describe, expect, it } from 'vitest';
import { generateTotp, secretFromTotpUri } from './totp';

const RFC_6238_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('generateTotp', () => {
	it.each([
		[59_000, '287082'],
		[1_111_111_109_000, '081804'],
		[1_234_567_890_000, '005924'],
		[2_000_000_000_000, '279037']
	])('matches the RFC 6238 SHA-1 test vector at %i ms', (timestamp, code) => {
		expect(generateTotp(RFC_6238_SECRET, timestamp)).toBe(code);
	});

	it('reads the secret from an otpauth URI', () => {
		expect(
			secretFromTotpUri(
				`otpauth://totp/Servitor:ada%40example.com?secret=${RFC_6238_SECRET}&issuer=Servitor`
			)
		).toBe(RFC_6238_SECRET);
	});
});
