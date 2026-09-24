export function formFields(data: FormData): Record<string, string | undefined> {
	const entries = new Map<string, string>();

	for (const [key, value] of data) {
		if (typeof value === 'string' && !entries.has(key)) {
			entries.set(key, value);
		}
	}

	return Object.fromEntries(entries);
}

export function formList(data: FormData, name: string, limit: number): string[] {
	return data
		.getAll(name)
		.filter((value): value is string => typeof value === 'string')
		.slice(0, limit);
}

export async function readFormFields(
	request: Request
): Promise<Record<string, string | undefined>> {
	return formFields(await request.formData());
}
