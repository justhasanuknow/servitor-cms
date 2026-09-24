import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UI_LOCALES } from '$lib/constants/preferences';

const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

function readMessages(locale: string): Map<string, string> {
	const parsed: unknown = JSON.parse(readFileSync(resolve('messages', `${locale}.json`), 'utf8'));
	const messages = new Map<string, string>();

	if (typeof parsed !== 'object' || parsed === null) {
		return messages;
	}

	for (const [key, value] of Object.entries(parsed)) {
		if (key !== '$schema' && typeof value === 'string') {
			messages.set(key, value);
		}
	}

	return messages;
}

function placeholders(message: string): string[] {
	return [...message.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]).sort();
}

const english = readMessages('en');

describe.each(UI_LOCALES.filter((locale) => locale !== 'en'))('the %s messages', (locale) => {
	const messages = readMessages(locale);

	it('contain every key that exists in English', () => {
		const missing = [...english.keys()].filter((key) => !messages.has(key));

		expect(missing).toEqual([]);
	});

	it('contain no keys that English does not have', () => {
		const extra = [...messages.keys()].filter((key) => !english.has(key));

		expect(extra).toEqual([]);
	});

	it('use the same placeholders as English', () => {
		const mismatched = [...english.entries()]
			.filter(([key, message]) => {
				const translated = messages.get(key);

				return (
					translated !== undefined &&
					placeholders(translated).join(',') !== placeholders(message).join(',')
				);
			})
			.map(([key]) => key);

		expect(mismatched).toEqual([]);
	});
});

describe('every locale', () => {
	it.each(UI_LOCALES)('%s has no empty messages', (locale) => {
		const empty = [...readMessages(locale).entries()]
			.filter(([, message]) => message.trim() === '')
			.map(([key]) => key);

		expect(empty).toEqual([]);
	});
});
