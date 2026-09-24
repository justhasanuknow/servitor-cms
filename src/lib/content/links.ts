import { MAX_HREF_LENGTH } from '../constants/content';

const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

const HTTP_URL_PATTERN = /^https?:\/\/[^/?#]/i;

const WHITESPACE = /\s/u;

const LAST_C0_CONTROL_OR_SPACE = 0x20;

const FIRST_C1_CONTROL = 0x7f;

const LAST_C1_CONTROL = 0x9f;

const MAILTO_PREFIX = 'mailto:';

export function isAllowedHref(href: string): boolean {
	if (href.length === 0 || href.length > MAX_HREF_LENGTH || hasForbiddenCharacter(href)) {
		return false;
	}

	const scheme = SCHEME_PATTERN.exec(href);

	if (scheme === null) {
		return !href.startsWith('//');
	}

	const name = scheme[1].toLowerCase();

	if (name === 'mailto') {
		return href.length > MAILTO_PREFIX.length;
	}

	if (name === 'http' || name === 'https') {
		return isHttpUrl(href);
	}

	return false;
}

export function isExternalHref(href: string): boolean {
	return HTTP_URL_PATTERN.test(href);
}

function isHttpUrl(href: string): boolean {
	if (!HTTP_URL_PATTERN.test(href)) {
		return false;
	}

	try {
		const url = new URL(href);

		return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
	} catch {
		return false;
	}
}

function hasForbiddenCharacter(value: string): boolean {
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;

		if (code <= LAST_C0_CONTROL_OR_SPACE || character === '\\' || WHITESPACE.test(character)) {
			return true;
		}

		if (code >= FIRST_C1_CONTROL && code <= LAST_C1_CONTROL) {
			return true;
		}
	}

	return false;
}
