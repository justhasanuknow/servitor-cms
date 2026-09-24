export function sameOriginPath(value: string | undefined, current: URL, fallback: string): string {
	if (value === undefined || !value.startsWith('/') || value.startsWith('//')) {
		return fallback;
	}

	if (!URL.canParse(value, current.origin)) {
		return fallback;
	}

	const target = new URL(value, current.origin);

	if (target.origin !== current.origin) {
		return fallback;
	}

	return `${target.pathname}${target.search}`;
}
