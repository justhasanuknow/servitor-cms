import { describe, expect, it } from 'vitest';
import commonPasswordList from './common-passwords.txt?raw';
import { findPasswordPolicyViolation } from './password-policy';

const commonPasswords = commonPasswordList
	.split(/\r?\n/)
	.map((entry) => entry.trim())
	.filter((entry) => entry.length > 0);

describe('findPasswordPolicyViolation', () => {
	it('accepts passwords from 12 to 128 characters', () => {
		expect(findPasswordPolicyViolation('Kx7-quiet-harbor-19')).toBeNull();
		expect(findPasswordPolicyViolation('q'.repeat(12))).toBeNull();
		expect(findPasswordPolicyViolation('q'.repeat(128))).toBeNull();
	});

	it('rejects passwords shorter than 12 characters', () => {
		expect(findPasswordPolicyViolation('q'.repeat(11))).toBe('too_short');
	});

	it('rejects passwords longer than 128 characters', () => {
		expect(findPasswordPolicyViolation('q'.repeat(129))).toBe('too_long');
	});

	it('bundles at least 10,000 common passwords', () => {
		expect(commonPasswords.length).toBeGreaterThanOrEqual(10_000);
	});

	it('rejects every password from the bundled list', () => {
		const accepted = commonPasswords.filter(
			(entry) => findPasswordPolicyViolation(entry) === null
		);

		expect(accepted).toEqual([]);
	});

	it('rejects common passwords regardless of letter case', () => {
		const longEntries = commonPasswords.filter((entry) => entry.length >= 12);

		expect(longEntries.length).toBeGreaterThan(0);

		for (const entry of longEntries) {
			expect(findPasswordPolicyViolation(entry.toUpperCase())).toBe('too_common');
		}
	});
});
