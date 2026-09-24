import { resetFounder } from './lib/server/auth/founder-reset';
import { parseEnv } from './lib/server/config/env';
import { MIGRATIONS_FOLDER, migrateDatabase, openDatabase } from './lib/server/db';

const USAGE = [
	'Usage: node build/cli.js <command>',
	'',
	'Commands:',
	'  reset-founder  Set a temporary founder password, disable two-factor authentication',
	'                 for the founder and sign the founder out of every session',
	''
].join('\n');

async function run(args: string[]): Promise<number> {
	if (args[0] !== 'reset-founder') {
		process.stderr.write(USAGE);

		return 1;
	}

	const env = parseEnv(process.env);
	const db = openDatabase(env.DATABASE_PATH);

	try {
		migrateDatabase(db, MIGRATIONS_FOLDER);

		const temporaryPassword = await resetFounder(db);

		process.stdout.write(
			`Temporary founder password: ${temporaryPassword}\nSign in with it and choose a new password right away.\n`
		);

		return 0;
	} finally {
		db.$client.close();
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
