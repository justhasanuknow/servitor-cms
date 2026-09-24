import { describe, expect, it } from 'vitest';
import { negotiateLocale, toUiLocale } from './locale-negotiation';

describe('negotiateLocale', () => {
	it.each([
		['tr-TR,tr;q=0.9,en;q=0.8', 'tr'],
		['de-AT', 'de'],
		['fr-CA,fr;q=0.9', 'fr'],
		['ja', 'ja'],
		['en-US,en;q=0.9', 'en'],
		['zh-CN,zh;q=0.9', 'zh-Hans'],
		['zh-Hans-CN', 'zh-Hans'],
		['zh', 'zh-Hans'],
		['zh-TW,zh-Hant;q=0.9,ja;q=0.8', 'ja'],
		['es-ES;q=0.9,de;q=0.8', 'de'],
		['en;q=0.2,tr;q=0.8', 'tr'],
		['*', undefined],
		['pt-BR', undefined]
	])('maps %s to %s', (header, expected) => {
		expect(negotiateLocale(header)).toBe(expected);
	});

	it('ignores a missing or malformed header', () => {
		expect(negotiateLocale(null)).toBeUndefined();
		expect(negotiateLocale(';;;,q=abc')).toBeUndefined();
		expect(negotiateLocale('de;q=0')).toBeUndefined();
	});
});

describe('toUiLocale', () => {
	it('matches supported locales case-insensitively', () => {
		expect(toUiLocale('ZH-hans')).toBe('zh-Hans');
		expect(toUiLocale('tr')).toBe('tr');
		expect(toUiLocale('xx')).toBeUndefined();
		expect(toUiLocale(undefined)).toBeUndefined();
	});
});
