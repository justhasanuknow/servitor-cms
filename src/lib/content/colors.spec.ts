import { describe, expect, it } from 'vitest';
import { allowedColorOrNull, isAllowedColor } from './colors';

describe('isAllowedColor', () => {
	it.each([
		'#fff',
		'#FFFA',
		'#0e0e99',
		'#0E0E9950',
		'rgb(14, 14, 153)',
		'rgba(14, 14, 153, 0.5)',
		'rgb(14 14 153 / 50%)',
		'rgb(10%, 20%, 30%)',
		'hsl(120, 50%, 50%)',
		'hsla(120deg, 50%, 50%, .3)',
		'hsl(120 50% 50% / 0.5)'
	])('allows %s', (value) => {
		expect(isAllowedColor(value)).toBe(true);
	});

	it.each([
		'red',
		'inherit',
		'currentcolor',
		'var(--primary)',
		'#ggg',
		'#12345',
		'rgb(1, 2)',
		'rgb(1, 2, 3); background: url(javascript:alert(1))',
		'expression(alert(1))',
		'url(https://example.com/a.png)',
		'rgb(1,2,3)/**/',
		'hsl(120, 50, 50)',
		''
	])('rejects %j', (value) => {
		expect(isAllowedColor(value)).toBe(false);
	});
});

describe('allowedColorOrNull', () => {
	it('trims allowed values and drops everything else', () => {
		expect(allowedColorOrNull('  #abc ')).toBe('#abc');
		expect(allowedColorOrNull('red')).toBeNull();
		expect(allowedColorOrNull(null)).toBeNull();
		expect(allowedColorOrNull(undefined)).toBeNull();
	});
});
