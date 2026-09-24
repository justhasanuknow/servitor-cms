import { describe, expect, it } from 'vitest';
import longCommonPasswordList from './common-passwords-long.txt?raw';
import commonPasswordList from './common-passwords.txt?raw';
import {
	contextWords,
	findPasswordPolicyViolation,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH
} from './password-policy';

function entries(list: string): string[] {
	return list
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

const commonPasswords = entries(commonPasswordList);

const longCommonPasswords = entries(longCommonPasswordList);

describe('findPasswordPolicyViolation', () => {
	it('accepts passwords from 12 to 128 characters', () => {
		expect(findPasswordPolicyViolation('Kx7-quiet-harbor-19')).toBeNull();
		expect(findPasswordPolicyViolation('Kx7-harbor-q')).toBeNull();
		expect(
			findPasswordPolicyViolation('Kx7-quiet-harbor-19'.repeat(7).slice(0, 128))
		).toBeNull();
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

	it('bundles at least 3,000 common passwords that the length rules would allow', () => {
		const allowedByLength = longCommonPasswords.filter(
			(entry) => entry.length >= PASSWORD_MIN_LENGTH && entry.length <= PASSWORD_MAX_LENGTH
		);

		expect(allowedByLength.length).toBeGreaterThanOrEqual(3_000);
		expect(allowedByLength).toHaveLength(longCommonPasswords.length);
	});

	it('rejects every long password from the breach-derived list', () => {
		const accepted = longCommonPasswords.filter(
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

describe('context-specific words', () => {
	const context = {
		name: 'Ada Lovelace',
		email: 'ada.lovelace@example.org',
		siteName: 'Harbor Notes',
		origin: 'https://cms.harbor-notes.test'
	};

	it.each([
		'Servitor2026!!',
		'S3rv1t0r-2026-x',
		'AdaLovelace1815!',
		'ada.lovelace@example.org',
		'harbornotes-2026',
		'Administrator-99',
		'Passw0rd-2026-01'
	])('rejects %s because it leans on context words', (password) => {
		expect(findPasswordPolicyViolation(password, context)).toBe('too_predictable');
	});

	it('does not count context words toward the minimum length', () => {
		expect(
			findPasswordPolicyViolation('lovelace plus a quiet red bicycle', context)
		).toBeNull();
		expect(findPasswordPolicyViolation('lovelace-bicycle', context)).toBe('too_predictable');
	});

	it('always checks the product and role names', () => {
		expect(findPasswordPolicyViolation('Founder!2026-07')).toBe('too_predictable');
		expect(findPasswordPolicyViolation('Kx7-quiet-harbor-19')).toBeNull();
	});

	it('derives the words from the name, the email address, the site and its host', () => {
		expect(contextWords(context)).toEqual(
			expect.arrayContaining([
				'lovelace',
				'adalovelace',
				'example',
				'harbornotes',
				'servitor'
			])
		);
		expect(contextWords(context)).not.toContain('ada');
	});
});
