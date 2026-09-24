import { appendFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { recordAuditEntry } from '../audit/audit-log';
import type { AuthUser } from '../auth/auth';
import type { AuthRequest } from '../auth/auth-request.interfaces';
import type { DataPaths } from '../operations/backup.interfaces';
import {
	checkArchive,
	dataPaths,
	freeBytes,
	timestamp,
	uniqueArchivePath
} from '../operations/backup';
import {
	decryptBackupFile,
	isEncryptedBackup,
	passphraseProblem
} from '../operations/backup-crypto';
import { restoreProblem } from '../operations/restore-request';
import type { Runtime } from '../runtime.interfaces';
import { reportSecurityEvent } from '../security/security-events';
import { requireBackupAccess } from './backup-access';
import type {
	UploadAppendResult,
	UploadCompleteResult,
	UploadSession,
	UploadStartResult
} from './backups.interfaces';

export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

const INCOMING_DIRECTORY = 'incoming';

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const UPLOAD_ID = /^[0-9a-f-]{36}$/;

const UPLOAD_START_RULE = { windowMs: 60 * 1000, max: 5 };

const sessions = new Map<string, UploadSession>();

function incomingDirectory(paths: DataPaths): string {
	return join(paths.backupsDir, INCOMING_DIRECTORY);
}

function sessionFor(actor: AuthUser, id: string): UploadSession | null {
	if (!UPLOAD_ID.test(id)) {
		return null;
	}

	const session = sessions.get(id);

	if (session === undefined || session.ownerId !== actor.id) {
		return null;
	}

	return session;
}

async function discard(session: UploadSession): Promise<void> {
	sessions.delete(session.id);
	await rm(session.path, { force: true });
	await rm(`${session.path}.tar.gz`, { force: true });
}

export async function startUpload(
	runtime: Runtime,
	actor: AuthUser,
	size: number
): Promise<UploadStartResult> {
	if (!requireBackupAccess(actor)) {
		return { status: 'two_factor_required' };
	}

	const limit = runtime.rateLimiter.consume(`backup-upload:${actor.id}`, UPLOAD_START_RULE);

	if (!limit.allowed) {
		reportSecurityEvent({ type: 'rate_limited', limit: 'backup_upload', userId: actor.id });

		return { status: 'rate_limited' };
	}

	if (!Number.isSafeInteger(size) || size <= 0) {
		return { status: 'invalid_size' };
	}

	const paths = dataPaths(runtime.env);
	const directory = incomingDirectory(paths);

	await mkdir(directory, { recursive: true });

	for (const session of [...sessions.values()]) {
		if (session.ownerId === actor.id) {
			await discard(session);
		}
	}

	if (size * 2 > (await freeBytes(directory))) {
		return { status: 'insufficient_space' };
	}

	const id = crypto.randomUUID();
	const session: UploadSession = {
		id,
		ownerId: actor.id,
		size,
		received: 0,
		path: join(directory, `${id}.part`),
		createdAt: new Date()
	};

	sessions.set(id, session);

	return { status: 'started', id, chunkBytes: UPLOAD_CHUNK_BYTES };
}

export async function appendUpload(
	runtime: Runtime,
	actor: AuthUser,
	id: string,
	offset: number,
	chunk: Uint8Array
): Promise<UploadAppendResult> {
	if (!requireBackupAccess(actor)) {
		return { status: 'two_factor_required' };
	}

	const session = sessionFor(actor, id);

	if (session === null) {
		return { status: 'not_found' };
	}

	if (
		offset !== session.received ||
		chunk.byteLength === 0 ||
		chunk.byteLength > UPLOAD_CHUNK_BYTES ||
		session.received + chunk.byteLength > session.size
	) {
		return { status: 'out_of_order', received: session.received };
	}

	await appendFile(session.path, chunk);
	session.received += chunk.byteLength;

	return { status: 'received', received: session.received };
}

export async function completeUpload(
	runtime: Runtime,
	request: AuthRequest,
	actor: AuthUser,
	id: string,
	passphrase: string | null
): Promise<UploadCompleteResult> {
	if (!requireBackupAccess(actor)) {
		return { status: 'two_factor_required' };
	}

	const session = sessionFor(actor, id);

	if (session === null) {
		return { status: 'not_found' };
	}

	if (session.received !== session.size) {
		return { status: 'incomplete' };
	}

	const paths = dataPaths(runtime.env);
	const encrypted = await isEncryptedBackup(session.path);
	let archive = session.path;

	if (encrypted) {
		if (passphrase === null || passphraseProblem(passphrase) !== null) {
			return { status: 'passphrase_required' };
		}

		archive = `${session.path}.tar.gz`;
		await rm(archive, { force: true });

		const decrypted = await decryptBackupFile(session.path, archive, passphrase);

		if (decrypted === 'wrong_passphrase') {
			return { status: 'wrong_passphrase' };
		}

		if (decrypted === 'invalid') {
			await discard(session);

			return { status: 'invalid_archive', problem: 'damaged' };
		}
	}

	const checked = await checkArchive(archive, incomingDirectory(paths));

	if (checked.status === 'invalid_archive') {
		await discard(session);

		return { status: 'invalid_archive', problem: restoreProblem(checked.reason) };
	}

	const target = await uniqueArchivePath(
		paths.backupsDir,
		`servitor-upload-${timestamp(new Date())}`
	);
	const size = (await stat(archive)).size;

	await rename(archive, target);
	await discard(session);
	recordAuditEntry(runtime.db, {
		actorType: 'user',
		actorId: actor.id,
		action: 'backup.uploaded',
		targetType: 'backup',
		details: { archive: basename(target), size, encrypted },
		ip: request.ip,
		userAgent: request.userAgent
	});

	return { status: 'uploaded', archive: basename(target) };
}

export async function cancelUpload(actor: AuthUser, id: string): Promise<boolean> {
	const session = sessionFor(actor, id);

	if (session === null) {
		return false;
	}

	await discard(session);

	return true;
}

export async function removeStaleUploads(paths: DataPaths, now: Date = new Date()): Promise<void> {
	const directory = incomingDirectory(paths);
	let names: string[];

	try {
		names = await readdir(directory);
	} catch {
		return;
	}

	for (const name of names) {
		const path = join(directory, name);
		const id = name.split('.')[0];

		try {
			const details = await stat(path);

			if (now.getTime() - details.mtimeMs > STALE_UPLOAD_MS) {
				sessions.delete(id);
				await rm(path, { force: true, recursive: true });
			}
		} catch {
			continue;
		}
	}
}
