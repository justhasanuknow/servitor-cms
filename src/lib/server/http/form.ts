export async function readFormFields(
	request: Request
): Promise<Record<string, string | undefined>> {
	const entries = new Map<string, string>();

	for (const [key, value] of await request.formData()) {
		if (typeof value === 'string' && !entries.has(key)) {
			entries.set(key, value);
		}
	}

	return Object.fromEntries(entries);
}
