import { describe, expect, it } from 'vitest';
import { sameOriginPath } from './redirect-target';

const current = new URL('https://cms.example.com/panel/login');

describe('sameOriginPath', () => {
	it.each([
		['/panel/login', '/panel/login'],
		['/panel/users?page=2', '/panel/users?page=2'],
		['/panel/login#top', '/panel/login']
	])('keeps the local path %s', (value, expected) => {
		expect(sameOriginPath(value, current, '/panel')).toBe(expected);
	});

	it.each([
		undefined,
		'',
		'https://evil.example/',
		'//evil.example/path',
		'/\\evil.example',
		'javascript:alert(1)',
		'panel/login'
	])('falls back for %s', (value) => {
		expect(sameOriginPath(value, current, '/panel')).toBe('/panel');
	});
});
