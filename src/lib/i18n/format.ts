import { getLocale } from '$lib/paraglide/runtime';

const KILOBYTE = 1024;

const MEGABYTE = KILOBYTE * 1024;

export function formatByteSize(bytes: number): string {
	if (bytes >= MEGABYTE) {
		return unitFormat('megabyte').format(bytes / MEGABYTE);
	}

	return unitFormat('kilobyte').format(Math.max(bytes / KILOBYTE, 0.1));
}

function unitFormat(unit: 'kilobyte' | 'megabyte'): Intl.NumberFormat {
	return new Intl.NumberFormat(getLocale(), {
		style: 'unit',
		unit,
		unitDisplay: 'short',
		maximumFractionDigits: 1
	});
}
