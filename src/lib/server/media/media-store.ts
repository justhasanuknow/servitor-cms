import { mkdirSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaVariant } from '../../constants/media';
import { isMediaId, isMediaVariant } from '../../content/media-urls';
import type { ProcessedVariant } from './image-processing.interfaces';

const STAGING_PREFIX = '.staging-';

const RENAME_ATTEMPTS = 5;

const RENAME_RETRY_DELAY_MS = 50;

const TRANSIENT_RENAME_ERRORS = new Set(['EPERM', 'EBUSY', 'EACCES']);

function isTransientRenameError(error: unknown): boolean {
	return (
		error instanceof Error && 'code' in error && TRANSIENT_RENAME_ERRORS.has(String(error.code))
	);
}

async function renameWhenReleased(from: string, to: string): Promise<void> {
	for (let attempt = 1; attempt < RENAME_ATTEMPTS; attempt += 1) {
		try {
			await rename(from, to);

			return;
		} catch (error) {
			if (!isTransientRenameError(error)) {
				throw error;
			}
		}

		await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_DELAY_MS * attempt));
	}

	await rename(from, to);
}

export class MediaStore {
	readonly root: string;

	constructor(root: string) {
		this.root = root;
	}

	prepare(): void {
		mkdirSync(this.root, { recursive: true });
	}

	async save(id: string, variants: ProcessedVariant[]): Promise<void> {
		const directory = this.directory(id);
		const staging = join(this.root, `${STAGING_PREFIX}${crypto.randomUUID()}`);

		await mkdir(staging, { recursive: true });

		try {
			for (const entry of variants) {
				await writeFile(join(staging, fileName(entry.variant)), entry.data, { flag: 'wx' });
			}

			await renameWhenReleased(staging, directory);
		} catch (error) {
			await rm(staging, { recursive: true, force: true });

			throw error;
		}
	}

	async read(id: string, variant: MediaVariant): Promise<Buffer | null> {
		try {
			return await readFile(this.file(id, variant));
		} catch (error) {
			if (isMissingFile(error)) {
				return null;
			}

			throw error;
		}
	}

	async remove(id: string): Promise<void> {
		await rm(this.directory(id), { recursive: true, force: true });
	}

	private directory(id: string): string {
		if (!isMediaId(id)) {
			throw new Error('Refusing to use an invalid media id');
		}

		return join(this.root, id);
	}

	private file(id: string, variant: MediaVariant): string {
		if (!isMediaVariant(variant)) {
			throw new Error('Refusing to use an invalid media variant');
		}

		return join(this.directory(id), fileName(variant));
	}
}

function fileName(variant: MediaVariant): string {
	return `${variant}.webp`;
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
