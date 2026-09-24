import { createWriteStream, existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, backupSchedule } from '../db/schema';
import { createBackup, dataPaths } from '../operations/backup';
import type { DataPaths } from '../operations/backup.interfaces';
import { encryptingStream } from '../operations/backup-crypto';
import { hasPendingRestore } from '../operations/restore-request';
import { createTestRuntime } from '../testing/runtime';
import { signInWithTwoFactor } from '../testing/two-factor';
import type { TwoFactorUser } from '../testing/two-factor.interfaces';
import { backupJobs } from './backup-jobs';
import { runScheduledBackup } from './backup-scheduler';
import { listArchives } from './backup-store';
import {
	appendUpload,
	completeUpload,
	removeStaleUploads,
	startUpload,
	UPLOAD_CHUNK_BYTES
} from './backup-uploads';
import {
	authorizeDownload,
	backupsOverview,
	deleteBackupArchive,
	requestPanelRestore,
	startManualBackup
} from './backups';
import { recordRestoreOutcome } from './restore-outcome';

const PASSWORD = 'Kx7-quiet-harbor-19';

const PASSPHRASE = 'a long enough passphrase';

let harness: ReturnType<typeof createTestRuntime>;

let paths: DataPaths;

beforeEach(() => {
	harness = createTestRuntime({ mail: true });
	paths = dataPaths(harness.runtime.env);
});

afterEach(() => {
	harness.dispose();
});

function actions(action: string) {
	return harness.runtime.db.select().from(auditLog).where(eq(auditLog.action, action)).all();
}

async function founderWithTwoFactor(): Promise<TwoFactorUser> {
	await harness.createUser({ email: 'founder@example.com', password: PASSWORD, role: 'founder' });

	return signInWithTwoFactor(harness, 'founder@example.com', PASSWORD);
}

async function uploadBytes(founder: TwoFactorUser, bytes: Buffer): Promise<string> {
	const started = await startUpload(harness.runtime, founder.actor, bytes.length);

	if (started.status !== 'started') {
		throw new Error(`The upload did not start: ${started.status}`);
	}

	for (let offset = 0; offset < bytes.length; offset += UPLOAD_CHUNK_BYTES) {
		const result = await appendUpload(
			harness.runtime,
			founder.actor,
			started.id,
			offset,
			bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES)
		);

		expect(result.status).toBe('received');
	}

	return started.id;
}

async function encrypted(bytes: Buffer): Promise<Buffer> {
	const path = join(paths.dataDir, 'encrypted.enc');

	await pipeline(
		Readable.from([bytes]),
		await encryptingStream(PASSPHRASE),
		createWriteStream(path)
	);

	return readFile(path);
}

describe('backup jobs', () => {
	it('creates one backup at a time in the background and records it', async () => {
		const founder = await founderWithTwoFactor();

		expect(startManualBackup(harness.runtime, founder.actor)).toBe('started');
		expect(startManualBackup(harness.runtime, founder.actor)).toBe('busy');

		const job = await backupJobs(harness.runtime).settled();

		expect(job).toMatchObject({ status: 'succeeded', source: 'panel' });
		expect((await listArchives(paths)).map((archive) => archive.name)).toEqual([job?.archive]);
		expect(actions('backup.created')).toMatchObject([
			{ actorType: 'user', actorId: founder.actor.id }
		]);
		expect(startManualBackup(harness.runtime, founder.actor)).toBe('started');
		await backupJobs(harness.runtime).settled();
	});

	it('reports a failed scheduled backup to the founder', async () => {
		await founderWithTwoFactor();
		writeFileSync(paths.backupsDir, 'a file where the folder should be');

		expect(backupJobs(harness.runtime).start('schedule', null).status).toBe('started');

		const job = await backupJobs(harness.runtime).settled();

		expect(job?.status).toBe('failed');
		expect(actions('backup.failed')).toMatchObject([{ actorType: 'system' }]);
		await expect.poll(() => harness.emails.length).toBe(1);
		expect(harness.emails[0].to).toBe('founder@example.com');
	});

	it('needs two-factor authentication and the founder role', async () => {
		await harness.createUser({
			email: 'founder@example.com',
			password: PASSWORD,
			role: 'founder'
		});
		await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });

		const founder = await harness.signIn('founder@example.com', PASSWORD);
		const admin = await harness.signIn('admin@example.com', PASSWORD);

		expect(startManualBackup(harness.runtime, founder.actor)).toBe('two_factor_required');
		expect(() => startManualBackup(harness.runtime, admin.actor)).toThrow();
		expect((await backupsOverview(harness.runtime, founder.actor)).allowed).toBe(false);
	});
});

describe('scheduled backups', () => {
	it('creates a due backup once and keeps the configured number', async () => {
		await createBackup(harness.runtime.db, paths, {
			source: 'schedule',
			now: new Date('2026-09-20T03:00:00.000Z')
		});
		harness.runtime.db
			.insert(backupSchedule)
			.values({
				id: 1,
				frequency: 'daily',
				hour: 3,
				retention: 1,
				updatedAt: new Date('2026-09-01T00:00:00.000Z')
			})
			.run();

		expect(await runScheduledBackup(harness.runtime, new Date(), null)).toBe('started');
		expect((await backupJobs(harness.runtime).settled())?.status).toBe('succeeded');

		const archives = await listArchives(paths);

		expect(archives).toHaveLength(1);
		expect(archives[0].kind).toBe('auto');
		expect(await runScheduledBackup(harness.runtime, new Date(), null)).toBe('idle');
	});

	it('waits an hour after a failure and does nothing while switched off', async () => {
		expect(await runScheduledBackup(harness.runtime, new Date(), null)).toBe('idle');

		harness.runtime.db
			.insert(backupSchedule)
			.values({ id: 1, frequency: 'daily', updatedAt: new Date('2026-09-01T00:00:00.000Z') })
			.run();

		expect(
			await runScheduledBackup(harness.runtime, new Date(), new Date(Date.now() - 60_000))
		).toBe('idle');
	});
});

describe('uploads', () => {
	it('assembles chunks into a checked archive', async () => {
		const founder = await founderWithTwoFactor();
		const source = await readFile(await createBackup(harness.runtime.db, paths));
		const id = await uploadBytes(founder, source);
		const result = await completeUpload(
			harness.runtime,
			harness.request(founder.jar),
			founder.actor,
			id,
			null
		);

		expect(result).toMatchObject({ status: 'uploaded' });

		if (result.status === 'uploaded') {
			expect(readFileSync(join(paths.backupsDir, result.archive)).equals(source)).toBe(true);
			expect(result.archive).toMatch(/^servitor-upload-/);
		}

		expect(actions('backup.uploaded')).toHaveLength(1);
	});

	it('asks for the passphrase of an encrypted archive until it is right', async () => {
		const founder = await founderWithTwoFactor();
		const plain = await readFile(await createBackup(harness.runtime.db, paths));
		const id = await uploadBytes(founder, await encrypted(plain));
		const request = harness.request(founder.jar);

		expect(await completeUpload(harness.runtime, request, founder.actor, id, null)).toEqual({
			status: 'passphrase_required'
		});
		expect(
			await completeUpload(
				harness.runtime,
				request,
				founder.actor,
				id,
				'the wrong passphrase'
			)
		).toEqual({ status: 'wrong_passphrase' });

		const result = await completeUpload(
			harness.runtime,
			request,
			founder.actor,
			id,
			PASSPHRASE
		);

		expect(result).toMatchObject({ status: 'uploaded' });

		if (result.status === 'uploaded') {
			expect(readFileSync(join(paths.backupsDir, result.archive)).equals(plain)).toBe(true);
		}
	});

	it('refuses chunks out of order and archives that are not backups', async () => {
		const founder = await founderWithTwoFactor();
		const started = await startUpload(harness.runtime, founder.actor, 10);

		if (started.status !== 'started') {
			throw new Error('The upload did not start');
		}

		expect(
			await appendUpload(harness.runtime, founder.actor, started.id, 5, Buffer.from('abcde'))
		).toEqual({ status: 'out_of_order', received: 0 });
		expect(
			await completeUpload(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				started.id,
				null
			)
		).toEqual({ status: 'incomplete' });
		expect(
			await appendUpload(
				harness.runtime,
				founder.actor,
				started.id,
				0,
				Buffer.from('0123456789')
			)
		).toEqual({ status: 'received', received: 10 });
		expect(
			await completeUpload(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				started.id,
				null
			)
		).toEqual({ status: 'invalid_archive', problem: 'foreign' });
		expect(await listArchives(paths)).toEqual([]);
	});

	it('removes uploads that were left unfinished for a day', async () => {
		const incoming = join(paths.backupsDir, 'incoming');
		const stale = join(incoming, 'stale.part');
		const fresh = join(incoming, 'fresh.part');

		await mkdir(incoming, { recursive: true });
		writeFileSync(stale, 'old');
		writeFileSync(fresh, 'new');
		utimesSync(
			stale,
			new Date('2026-09-01T00:00:00.000Z'),
			new Date('2026-09-01T00:00:00.000Z')
		);
		await removeStaleUploads(paths);

		expect(existsSync(stale)).toBe(false);
		expect(existsSync(fresh)).toBe(true);
	});
});

describe('downloads and deletions', () => {
	it('allows a download after confirmation, records it and tells the founder', async () => {
		const founder = await founderWithTwoFactor();
		const archive = basename(await createBackup(harness.runtime.db, paths));
		const request = harness.request(founder.jar);

		expect(
			await authorizeDownload(harness.runtime, request, founder.actor, archive, {
				passphrase: PASSPHRASE,
				passphraseConfirmation: 'something else entirely',
				confirmation: { password: PASSWORD, totpCode: founder.spareCodes[0] }
			})
		).toEqual({ status: 'passphrase_mismatch' });
		expect(
			await authorizeDownload(harness.runtime, request, founder.actor, archive, {
				passphrase: 'short',
				passphraseConfirmation: 'short',
				confirmation: { password: PASSWORD, totpCode: founder.spareCodes[0] }
			})
		).toEqual({ status: 'passphrase_too_short' });
		expect(
			await authorizeDownload(harness.runtime, request, founder.actor, '../servitor.db', {
				passphrase: '',
				passphraseConfirmation: '',
				confirmation: { password: PASSWORD, totpCode: founder.spareCodes[0] }
			})
		).toEqual({ status: 'not_found' });
		expect(
			await authorizeDownload(harness.runtime, request, founder.actor, archive, {
				passphrase: PASSPHRASE,
				passphraseConfirmation: PASSPHRASE,
				confirmation: { password: PASSWORD, totpCode: founder.spareCodes[0] }
			})
		).toMatchObject({ status: 'authorized', name: archive, passphrase: PASSPHRASE });
		expect(actions('backup.downloaded')).toMatchObject([
			{ actorId: founder.actor.id, details: { archive, encrypted: true } }
		]);
		await expect.poll(() => harness.emails.length).toBe(1);
	});

	it('deletes an archive after confirmation', async () => {
		const founder = await founderWithTwoFactor();
		const archive = basename(await createBackup(harness.runtime.db, paths));
		const request = harness.request(founder.jar);

		expect(
			await deleteBackupArchive(harness.runtime, request, founder.actor, archive, {
				password: 'not the password',
				totpCode: founder.spareCodes[0]
			})
		).toBe('invalid_password');
		expect(
			await deleteBackupArchive(harness.runtime, request, founder.actor, archive, {
				password: PASSWORD,
				totpCode: founder.spareCodes[0]
			})
		).toBe('deleted');
		expect(await listArchives(paths)).toEqual([]);
		expect(actions('backup.deleted')).toHaveLength(1);
	});
});

describe('restore requests', () => {
	it('checks the archive and asks for a restart', async () => {
		const founder = await founderWithTwoFactor();
		const archive = basename(await createBackup(harness.runtime.db, paths));
		const request = harness.request(founder.jar);
		const confirmation = { password: PASSWORD, totpCode: founder.spareCodes[0] };

		expect(
			await requestPanelRestore(
				harness.runtime,
				request,
				founder.actor,
				archive,
				confirmation,
				false
			)
		).toEqual({ status: 'not_confirmed' });
		expect(await hasPendingRestore(paths)).toBe(false);
		expect(
			await requestPanelRestore(
				harness.runtime,
				request,
				founder.actor,
				archive,
				confirmation,
				true
			)
		).toEqual({ status: 'scheduled' });
		expect(await hasPendingRestore(paths)).toBe(true);
		expect(actions('backup.restore_requested')).toHaveLength(1);
		expect(
			JSON.parse(readFileSync(join(paths.backupsDir, 'restore-pending.json'), 'utf8'))
		).toMatchObject({
			archive,
			requestedBy: 'founder@example.com'
		});
	});

	it('refuses an archive that is not a valid backup', async () => {
		const founder = await founderWithTwoFactor();
		const archive = 'servitor-upload-2026-09-24T12-00-00Z.tar.gz';

		await mkdir(paths.backupsDir, { recursive: true });
		writeFileSync(join(paths.backupsDir, archive), 'not an archive');

		expect(
			await requestPanelRestore(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				archive,
				{ password: PASSWORD, totpCode: founder.spareCodes[0] },
				true
			)
		).toEqual({ status: 'invalid_archive', problem: 'foreign' });
		expect(await hasPendingRestore(paths)).toBe(false);
	});

	it('records the outcome of a restore after the restart', () => {
		recordRestoreOutcome(harness.runtime, {
			status: 'restored',
			archive: 'servitor-backup-2026-09-24T12-00-00Z.tar.gz',
			requestedBy: 'founder@example.com',
			finishedAt: new Date().toISOString(),
			previousDataDir: '.pre-restore-2026-09-24T12-00-00Z'
		});
		recordRestoreOutcome(harness.runtime, {
			status: 'failed',
			archive: 'servitor-backup-2026-09-24T12-00-00Z.tar.gz',
			requestedBy: 'founder@example.com',
			finishedAt: new Date().toISOString(),
			problem: 'damaged',
			reason: 'the archive cannot be read'
		});
		recordRestoreOutcome(harness.runtime, null);

		expect(actions('backup.restored')).toMatchObject([{ actorType: 'system' }]);
		expect(actions('backup.restore_failed')).toMatchObject([
			{ details: { reason: 'the archive cannot be read' } }
		]);
	});
});
