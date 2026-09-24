function pad(value: number): string {
	return String(value).padStart(2, '0');
}

export function localDateTimeValue(date: Date): string {
	const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

	return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function scheduleIso(value: string): string {
	if (value === '') {
		return '';
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toISOString();
}
