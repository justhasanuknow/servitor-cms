import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_PALETTES } from '../../constants/preferences';

const THEMES_DIRECTORY = resolve('src', 'lib', 'styles', 'themes');

function readPalette(palette: string): string {
	return readFileSync(resolve(THEMES_DIRECTORY, `${palette}.css`), 'utf8');
}

const SOURCES = new Map(THEME_PALETTES.map((palette) => [palette, readPalette(palette)]));

const neutral = readPalette('neutral');

const TEXT_PAIRS: [string, string][] = [
	['foreground', 'background'],
	['card-foreground', 'card'],
	['popover-foreground', 'popover'],
	['primary-foreground', 'primary'],
	['secondary-foreground', 'secondary'],
	['muted-foreground', 'background'],
	['muted-foreground', 'card'],
	['muted-foreground', 'muted'],
	['accent-foreground', 'accent'],
	['destructive', 'background'],
	['destructive', 'card'],
	['primary', 'background'],
	['sidebar-foreground', 'sidebar'],
	['sidebar-primary-foreground', 'sidebar-primary'],
	['sidebar-accent-foreground', 'sidebar-accent']
];

const TOKEN_PATTERN = /--([a-z0-9-]+):\s*light-dark\((oklch\([^)]*\)),\s*(oklch\([^)]*\))\);/g;

const OKLCH_PATTERN = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/;

function parseTokens(source: string): Map<string, [string, string]> {
	const tokens = new Map<string, [string, string]>();

	for (const match of source.matchAll(TOKEN_PATTERN)) {
		tokens.set(match[1], [match[2], match[3]]);
	}

	return tokens;
}

function relativeLuminance(color: string): number {
	const match = OKLCH_PATTERN.exec(color);

	if (!match) {
		throw new Error(`Only opaque oklch() colors can be checked: ${color}`);
	}

	const lightness = Number(match[1]);
	const chroma = Number(match[2]);
	const hue = (Number(match[3]) * Math.PI) / 180;
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
	const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
	const blueChannel = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

	return 0.2126 * red + 0.7152 * green + 0.0722 * blueChannel;
}

function clamp(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function contrast(first: string, second: string): number {
	const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
	const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

	return (lighter + 0.05) / (darker + 0.05);
}

const base = parseTokens(neutral);

describe.each(THEME_PALETTES)('the %s palette', (palette) => {
	const tokens = new Map([...base, ...parseTokens(SOURCES.get(palette) ?? '')]);

	it.each(TEXT_PAIRS)('%s on %s meets WCAG AA in light and dark mode', (text, surface) => {
		const textColors = tokens.get(text);
		const surfaceColors = tokens.get(surface);

		expect(textColors).toBeDefined();
		expect(surfaceColors).toBeDefined();

		for (const index of [0, 1]) {
			expect(
				contrast(textColors?.[index] ?? '', surfaceColors?.[index] ?? '')
			).toBeGreaterThanOrEqual(4.5);
		}
	});
});

describe('palette files', () => {
	it('define every token of the neutral base in light-dark() form', () => {
		expect(base.size).toBe(31);

		for (const palette of THEME_PALETTES) {
			expect(SOURCES.get(palette)).toContain(`[data-palette='${palette}']`);
		}
	});
});
