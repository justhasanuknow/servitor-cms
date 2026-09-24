import { describe, expect, it } from 'vitest';
import { readingTimeMinutes } from './content-text';

describe('readingTimeMinutes', () => {
	it('returns zero for empty text', () => {
		expect(readingTimeMinutes('')).toBe(0);
		expect(readingTimeMinutes('  \n ')).toBe(0);
	});

	it('rounds short texts up to one minute', () => {
		expect(readingTimeMinutes('Hello world')).toBe(1);
	});

	it('counts about 200 words per minute', () => {
		expect(readingTimeMinutes('word '.repeat(400))).toBe(2);
		expect(readingTimeMinutes('word '.repeat(401))).toBe(3);
	});

	it('counts about 500 characters per minute for CJK scripts', () => {
		expect(readingTimeMinutes('字'.repeat(1000))).toBe(2);
		expect(readingTimeMinutes('ひ'.repeat(1500))).toBe(3);
	});

	it('combines words and CJK characters in mixed text', () => {
		expect(readingTimeMinutes(`${'word '.repeat(200)}${'字'.repeat(500)}`)).toBe(2);
	});

	it('does not count punctuation as words', () => {
		expect(readingTimeMinutes('— … ! ?')).toBe(0);
	});
});
