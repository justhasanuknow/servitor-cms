const NUMBER = String.raw`(?:\d{1,3}(?:\.\d{1,4})?|\.\d{1,4})`;

const CHANNEL = `${NUMBER}%?`;

const HUE = `-?${NUMBER}(?:deg)?`;

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const RGB_COMMA_COLOR = new RegExp(
	String.raw`^rgba?\(\s*${CHANNEL}\s*,\s*${CHANNEL}\s*,\s*${CHANNEL}\s*(?:,\s*${CHANNEL}\s*)?\)$`,
	'i'
);

const RGB_SPACE_COLOR = new RegExp(
	String.raw`^rgba?\(\s*${CHANNEL}\s+${CHANNEL}\s+${CHANNEL}\s*(?:\/\s*${CHANNEL}\s*)?\)$`,
	'i'
);

const HSL_COMMA_COLOR = new RegExp(
	String.raw`^hsla?\(\s*${HUE}\s*,\s*${NUMBER}%\s*,\s*${NUMBER}%\s*(?:,\s*${CHANNEL}\s*)?\)$`,
	'i'
);

const HSL_SPACE_COLOR = new RegExp(
	String.raw`^hsla?\(\s*${HUE}\s+${NUMBER}%\s+${NUMBER}%\s*(?:\/\s*${CHANNEL}\s*)?\)$`,
	'i'
);

export const MAX_COLOR_LENGTH = 64;

export const COLOR_PATTERNS: readonly RegExp[] = [
	HEX_COLOR,
	RGB_COMMA_COLOR,
	RGB_SPACE_COLOR,
	HSL_COMMA_COLOR,
	HSL_SPACE_COLOR
];

export function isAllowedColor(value: string): boolean {
	return (
		value.length <= MAX_COLOR_LENGTH && COLOR_PATTERNS.some((pattern) => pattern.test(value))
	);
}

export function allowedColorOrNull(value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	const trimmed = value.trim();

	if (isAllowedColor(trimmed)) {
		return trimmed;
	}

	return null;
}
