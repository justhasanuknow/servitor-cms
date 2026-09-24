import { getLocale } from '$lib/paraglide/runtime';

const KILOBYTE = 1024;

const MEGABYTE = KILOBYTE * 1024;

const GIGABYTE = MEGABYTE * 1024;

export function formatByteSize(bytes: number): string {
	if (bytes >= GIGABYTE) {
		return unitFormat('gigabyte').format(bytes / GIGABYTE);
	}

	if (bytes >= MEGABYTE) {
		return unitFormat('megabyte').format(bytes / MEGABYTE);
	}

	return unitFormat('kilobyte').format(Math.max(bytes / KILOBYTE, 0.1));
}

function unitFormat(unit: 'kilobyte' | 'megabyte' | 'gigabyte'): Intl.NumberFormat {
	return new Intl.NumberFormat(getLocale(), {
		style: 'unit',
		unit,
		unitDisplay: 'short',
		maximumFractionDigits: 1
	});
}

export function formatDateTimeUtc(value: Date): string {
	return new Intl.DateTimeFormat(getLocale(), {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'UTC',
		timeZoneName: 'short'
	}).format(value);
}
