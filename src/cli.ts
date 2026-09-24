import { resetFounder } from './lib/server/auth/founder-reset';
import { revokeSessionsFromCli } from './lib/server/auth/session-revocation';
import { readEnv } from './lib/server/config/env';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase } from './lib/server/db';
import { createBackup, dataPaths, restoreBackup } from './lib/server/operations/backup';

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
