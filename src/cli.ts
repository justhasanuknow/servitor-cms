import { Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import { resetFounder } from './lib/server/auth/founder-reset';
import { revokeSessionsFromCli } from './lib/server/auth/session-revocation';
import { readEnv } from './lib/server/config/env';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase } from './lib/server/db';
import { createBackup, dataPaths, exists, restoreBackup } from './lib/server/operations/backup';
import {
	decryptBackupFile,
	ENCRYPTED_EXTENSION,
	isEncryptedBackup
} from './lib/server/operations/backup-crypto';

const USAGE = [
	'Usage: node build/cli.js <command>',
	'',
	'Commands:',
	'  reset-founder            Set a temporary founder password, disable two-factor authentication',
	'                           for the founder and sign the founder out of every session',
	'  backup                   Write a timestamped .tar.gz with a database snapshot and the uploads',
	'                           to the backups folder next to the database',
	'  restore <file> [--force] Replace the database and the uploads with a backup. Stop the app first;',
	'                           --force skips the check for a running app',
	'  decrypt-backup <file>    Decrypt a backup downloaded with a passphrase. The passphrase comes from',
	'                           BACKUP_PASSPHRASE or is asked for on the terminal',
	'  sign-out [email]         End every session of one user, or of all users without an email',
	''
].join('\n');

function write(text: string): void {
	process.stdout.write(`${text}\n`);
}

async function runResetFounder(): Promise<number> {
	const env = readEnv(process.env);
	const db = openDatabase(env.DATABASE_PATH);

	try {
		migrateDatabase(db, MIGRATIONS_FOLDER);

		const temporaryPassword = await resetFounder(db);

		write(`Temporary founder password: ${temporaryPassword}`);
		write('Sign in with it and choose a new password right away.');

		return 0;
	} finally {
		db.$client.close();
	}
}

async function runBackup(): Promise<number> {
	const env = readEnv(process.env);
	const db = openDatabase(env.DATABASE_PATH);

	try {
		migrateDatabase(db, MIGRATIONS_FOLDER);
		write(`Backup written to ${await createBackup(db, dataPaths(env))}`);

		return 0;
	} finally {
		db.$client.close();
	}
}

async function runRestore(args: string[]): Promise<number> {
	const file = args.find((arg) => !arg.startsWith('--'));
	const force = args.includes('--force');

	if (file === undefined) {
		process.stderr.write(USAGE);

		return 1;
	}

	if (!(await exists(file))) {
		process.stderr.write(`${file} does not exist.\n`);

		return 1;
	}

	if (await isEncryptedBackup(file)) {
		process.stderr.write(
			'This backup is encrypted. Decrypt it first with "decrypt-backup", or upload it in the panel.\n'
		);

		return 1;
	}

	const env = readEnv(process.env);
	const result = await restoreBackup(dataPaths(env), file, force);

	if (result.status === 'running') {
		process.stderr.write(
			'The app seems to be running. Stop it first, for example with "docker compose stop servitor",\n' +
				'then run the restore with "docker compose run --rm servitor node build/cli.js restore <file>".\n'
		);

		return 1;
	}

	if (result.status === 'invalid_archive') {
		process.stderr.write(`The backup cannot be restored: ${result.reason}.\n`);

		return 1;
	}

	write('The backup was restored.');
	write(`The previous database and uploads were moved to ${result.previousDataDir}.`);
	write('Start the app again; pending migrations run automatically.');

	return 0;
}

function readPassphrase(): Promise<string> {
	const fromEnvironment = process.env.BACKUP_PASSPHRASE;

	if (fromEnvironment !== undefined && fromEnvironment !== '') {
		return Promise.resolve(fromEnvironment);
	}

	const terminal = process.stdin.isTTY === true;
	const silent = new Writable({
		write(_chunk, _encoding, callback) {
			callback();
		}
	});
	const reader = createInterface({ input: process.stdin, output: silent, terminal });

	if (terminal) {
		process.stderr.write('Passphrase: ');
	}

	return new Promise((resolvePassphrase) => {
		reader.once('line', (line) => {
			resolvePassphrase(line);
			reader.close();
		});
		reader.once('close', () => {
			if (terminal) {
				process.stderr.write('\n');
			}

			resolvePassphrase('');
		});
	});
}

function decryptedName(file: string): string {
	if (file.endsWith(ENCRYPTED_EXTENSION)) {
		return file.slice(0, -ENCRYPTED_EXTENSION.length);
	}

	return `${file}.tar.gz`;
}

async function runDecrypt(args: string[]): Promise<number> {
	const file = args[0];

	if (file === undefined) {
		process.stderr.write(USAGE);

		return 1;
	}

	if (!(await exists(file)) || !(await isEncryptedBackup(file))) {
		process.stderr.write('This file is not an encrypted Servitor backup.\n');

		return 1;
	}

	const output = decryptedName(file);

	if (await exists(output)) {
		process.stderr.write(`${output} already exists. Move or delete it first.\n`);

		return 1;
	}

	const result = await decryptBackupFile(file, output, await readPassphrase());

	if (result === 'wrong_passphrase') {
		process.stderr.write('The passphrase is wrong.\n');

		return 1;
	}

	if (result === 'invalid') {
		process.stderr.write('The file is damaged or incomplete.\n');

		return 1;
	}

	write(`Decrypted backup written to ${output}`);

	return 0;
}

function runSignOut(args: string[]): number {
	const env = readEnv(process.env);
	const db = openDatabase(env.DATABASE_PATH);

	try {
		migrateDatabase(db, MIGRATIONS_FOLDER);

		const result = revokeSessionsFromCli(db, args[0] ?? null);

		if (result.status === 'unknown_user') {
			process.stderr.write('No account uses this email address.\n');

			return 1;
		}

		write(`Signed out ${result.count} session(s).`);

		return 0;
	} finally {
		db.$client.close();
	}
}

async function run(args: string[]): Promise<number> {
	switch (args[0]) {
		case 'reset-founder':
			return runResetFounder();
		case 'backup':
			return runBackup();
		case 'restore':
			return runRestore(args.slice(1));
		case 'decrypt-backup':
			return runDecrypt(args.slice(1));
		case 'sign-out':
			return runSignOut(args.slice(1));
		default:
			process.stderr.write(USAGE);

			return 1;
	}
}

run(process.argv.slice(2)).then(
	(code) => {
		process.exitCode = code;
	},
	(error: unknown) => {
		if (error instanceof Error) {
			process.stderr.write(`${error.message}\n`);
		} else {
			process.stderr.write(`${String(error)}\n`);
		}

		process.exitCode = 1;
	}
);
