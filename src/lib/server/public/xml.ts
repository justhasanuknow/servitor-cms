const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

const URL_ATTRIBUTE = /(\s(?:href|src)=")([^"]*)(")/g;

function isXmlCharacter(code: number): boolean {
	return (
		code === 0x9 ||
		code === 0xa ||
		code === 0xd ||
		(code >= 0x20 && code <= 0xd7ff) ||
		(code >= 0xe000 && code <= 0xfffd) ||
		(code >= 0x10000 && code <= 0x10ffff)
	);
}

function xmlCharacters(value: string): string {
	let result = '';

	for (const character of value) {
		if (isXmlCharacter(character.codePointAt(0) ?? 0)) {
			result += character;
		}
	}

	return result;
}

export function escapeXml(value: string): string {
	return xmlCharacters(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

export function absolutizeUrls(html: string, baseUrl: string): string {
	return html.replace(
		URL_ATTRIBUTE,
		(_match, prefix: string, value: string, suffix: string) =>
			`${prefix}${resolveUrl(value, baseUrl)}${suffix}`
	);
}

function resolveUrl(value: string, baseUrl: string): string {
	if (SCHEME_PATTERN.test(value)) {
		return value;
	}

	try {
		return new URL(value, baseUrl).href;
	} catch {
		return value;
	}
}
