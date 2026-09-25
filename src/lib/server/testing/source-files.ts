import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function svelteFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return svelteFiles(path);
		}

		if (entry.name.endsWith('.svelte')) {
			return [path];
		}

		return [];
	});
}
