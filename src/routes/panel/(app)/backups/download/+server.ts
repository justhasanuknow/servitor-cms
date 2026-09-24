import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { PANEL_ROUTES } from '$lib/constants/routes';
import { requireActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import { isArchiveName } from '$lib/server/backups/backup-store';
import { authorizeDownload } from '$lib/server/backups/backups';
import { readFormFields } from '$lib/server/http/form';
import { ENCRYPTED_EXTENSION, encryptingStream } from '$lib/server/operations/backup-crypto';
import { getRuntime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

const MAX_PASSPHRASE_INPUT = 2048;

const downloadSchema = z.object({
	name: z.string().max(200),
	passphrase: z.string().max(MAX_PASSPHRASE_INPUT).default(''),
	passphraseConfirmation: z.string().max(MAX_PASSPHRASE_INPUT).default(''),
	password: passwordField,
	totpCode: optionalCodeField
});

function failed(name: string, status: string): never {
	if (!isArchiveName(name)) {
		redirect(303, PANEL_ROUTES.backups);
	}

	redirect(
		303,
		`${PANEL_ROUTES.backups}/${encodeURIComponent(name)}?download_error=${encodeURIComponent(status)}`
	);
}

function webStream(source: Readable): ReadableStream<Uint8Array> {
	const chunks = source[Symbol.asyncIterator]();

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const next = await chunks.next();

			if (next.done === true) {
				controller.close();
			} else {
				controller.enqueue(new Uint8Array(next.value));
			}
		},
		cancel() {
			source.destroy();
		}
	});
}

async function body(path: string, passphrase: string | null): Promise<ReadableStream<Uint8Array>> {
	const source = createReadStream(path);

	if (passphrase === null) {
		return webStream(source);
	}

	const encryption = await encryptingStream(passphrase);

	source.on('error', (error) => encryption.destroy(error));

	return webStream(source.pipe(encryption));
}

export const POST: RequestHandler = async (event) => {
	const { user } = requireActor(event.locals);
	const fields = await readFormFields(event.request);
	const form = downloadSchema.safeParse(fields);

	if (!form.success) {
		failed(fields.name ?? '', 'invalid_input');
	}

	const { name, passphrase, passphraseConfirmation, password, totpCode } = form.data;
	const result = await authorizeDownload(getRuntime(), createAuthRequest(event), user, name, {
		passphrase,
		passphraseConfirmation,
		confirmation: { password, totpCode }
	});

	if (result.status !== 'authorized') {
		failed(name, result.status);
	}

	const headers = new Headers({
		'cache-control': 'no-store',
		'x-content-type-options': 'nosniff'
	});

	if (result.passphrase === null) {
		headers.set('content-type', 'application/gzip');
		headers.set('content-length', String((await stat(result.path)).size));
		headers.set('content-disposition', `attachment; filename="${result.name}"`);
	} else {
		headers.set('content-type', 'application/octet-stream');
		headers.set(
			'content-disposition',
			`attachment; filename="${result.name}${ENCRYPTED_EXTENSION}"`
		);
	}

	return new Response(await body(result.path, result.passphrase), { headers });
};
