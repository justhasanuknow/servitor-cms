import longCommonPasswordList from './common-passwords-long.txt?raw';
import commonPasswordList from './common-passwords.txt?raw';
import type { PasswordContext } from './password-policy.interfaces';

export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_MAX_LENGTH = 128;

export const CONTEXT_WORD_MIN_LENGTH = 4;

export const PRODUCT_CONTEXT_WORDS = [
	'servitor',
	'founder',
	'admin',
	'administrator',
	'author',
	'password'
] as const;

export type PasswordPolicyViolation = 'too_short' | 'too_long' | 'too_common' | 'too_predictable';

const COMMON_PASSWORDS = new Set(
	[commonPasswordList, longCommonPasswordList]
		.flatMap((list) => list.split(/\r?\n/))
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry) => entry.length > 0)
);

const LOOKALIKE_CHARACTERS = new Map([
	['0', 'o'],
	['1', 'i'],
	['3', 'e'],
	['4', 'a'],
	['5', 's'],
	['7', 't'],
	['@', 'a'],
	['$', 's']
]);

const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

export function findPasswordPolicyViolation(
	password: string,
	context: PasswordContext = {}
): PasswordPolicyViolation | null {
	if (password.length < PASSWORD_MIN_LENGTH) {
		return 'too_short';
	}

	if (password.length > PASSWORD_MAX_LENGTH) {
		return 'too_long';
	}

	if (COMMON_PASSWORDS.has(password.toLowerCase())) {
		return 'too_common';
	}

	if (withoutContextWords(password, contextWords(context)).length < PASSWORD_MIN_LENGTH) {
		return 'too_predictable';
	}

	return null;
}

export function contextWords(context: PasswordContext): string[] {
	const words = new Set<string>(PRODUCT_CONTEXT_WORDS);

	addWords(words, context.name);
	addWords(words, context.siteName);
	addWords(words, context.email);
	addWords(words, hostnameOf(context.origin));

	return [...words].sort((left, right) => right.length - left.length);
}

function withoutContextWords(password: string, words: string[]): string {
	let remaining = comparable(password);
	let previous = '';

	while (remaining !== previous) {
		previous = remaining;

		for (const word of words) {
			remaining = remaining.split(word).join('');
		}
	}

	return remaining;
}

function addWords(words: Set<string>, value: string | null | undefined): void {
	if (value === null || value === undefined) {
		return;
	}

	const lower = value.normalize('NFKC').toLowerCase();
	const parts = lower.split(WORD_SEPARATOR).filter((part) => part.length > 0);

	for (const candidate of [lower, parts.join(''), ...parts]) {
		const word = withoutLookalikes(candidate);

		if (word.length >= CONTEXT_WORD_MIN_LENGTH) {
			words.add(word);
		}
	}
}

function comparable(value: string): string {
	return withoutLookalikes(value.normalize('NFKC').toLowerCase());
}

function withoutLookalikes(value: string): string {
	return Array.from(value)
		.map((character) => LOOKALIKE_CHARACTERS.get(character) ?? character)
		.join('');
}

function hostnameOf(origin: string | null | undefined): string | null {
	if (origin === null || origin === undefined || !URL.canParse(origin)) {
		return null;
	}

	return new URL(origin).hostname;
}
