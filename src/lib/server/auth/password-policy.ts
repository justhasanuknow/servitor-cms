import commonPasswordList from './common-passwords.txt?raw';

export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_MAX_LENGTH = 128;

export type PasswordPolicyViolation = 'too_short' | 'too_long' | 'too_common';

const COMMON_PASSWORDS = new Set(
	commonPasswordList
		.split(/\r?\n/)
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry) => entry.length > 0)
);

export function findPasswordPolicyViolation(password: string): PasswordPolicyViolation | null {
	if (password.length < PASSWORD_MIN_LENGTH) {
		return 'too_short';
	}

	if (password.length > PASSWORD_MAX_LENGTH) {
		return 'too_long';
	}

	if (COMMON_PASSWORDS.has(password.toLowerCase())) {
		return 'too_common';
	}

	return null;
}
