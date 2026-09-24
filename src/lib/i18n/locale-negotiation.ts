import { UI_LOCALES, type UiLocale } from '$lib/constants/preferences';
import type { LanguageRange } from './locale-negotiation.interfaces';

const SIMPLIFIED_CHINESE_TAGS = new Set(['zh', 'zh-cn', 'zh-sg', 'zh-my', 'zh-hans']);

const MAX_HEADER_LENGTH = 1024;

export function toUiLocale(value: string | null | undefined): UiLocale | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}

	return UI_LOCALES.find((locale) => locale.toLowerCase() === value.toLowerCase());
}

export function negotiateLocale(header: string | null): UiLocale | undefined {
	if (header === null) {
		return undefined;
	}

	const ranges = header
		.slice(0, MAX_HEADER_LENGTH)
		.split(',')
		.map((part, index) => parseRange(part, index))
		.filter((range) => range.tag !== '' && range.quality > 0)
		.sort((first, second) => second.quality - first.quality || first.index - second.index);

	for (const range of ranges) {
		const locale = matchRange(range.tag);

		if (locale !== undefined) {
			return locale;
		}
	}

	return undefined;
}

function parseRange(part: string, index: number): LanguageRange {
	const [tag = '', ...parameters] = part.trim().split(';');
	let quality = 1;

	for (const parameter of parameters) {
		const [name, value] = parameter.trim().split('=');

		if (name === 'q' && value !== undefined) {
			quality = Number.parseFloat(value);
		}
	}

	if (Number.isNaN(quality)) {
		quality = 0;
	}

	return { tag: tag.trim().toLowerCase(), quality, index };
}

export function matchLanguageTag(tag: string): UiLocale | undefined {
	return matchRange(tag.trim().toLowerCase());
}

function matchRange(tag: string): UiLocale | undefined {
	if (tag.startsWith('zh')) {
		if (SIMPLIFIED_CHINESE_TAGS.has(tag) || tag.startsWith('zh-hans')) {
			return 'zh-Hans';
		}

		return undefined;
	}

	return toUiLocale(tag) ?? toUiLocale(tag.split('-')[0]);
}
