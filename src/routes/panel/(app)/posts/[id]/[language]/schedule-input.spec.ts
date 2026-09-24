import { describe, expect, it } from 'vitest';
import { localDateTimeValue, scheduleIso } from './schedule-input';

describe('schedule input', () => {
	it('formats a date for a datetime-local input', () => {
		const value = localDateTimeValue(new Date(2031, 0, 5, 7, 3, 45));

		expect(value).toBe('2031-01-05T07:03');
	});

	it('converts the local value back to the same instant', () => {
		const date = new Date(2031, 5, 15, 18, 30);

		expect(scheduleIso(localDateTimeValue(date))).toBe(date.toISOString());
	});

	it('keeps an empty value empty', () => {
		expect(scheduleIso('')).toBe('');
	});

	it('passes unreadable values through for the server to reject', () => {
		expect(scheduleIso('not a date')).toBe('not a date');
	});
});
