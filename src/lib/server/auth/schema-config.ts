import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { authSchemaOptions } from './options';

export const auth = betterAuth({
	...authSchemaOptions,
	database: drizzleAdapter(drizzle.mock(), { provider: 'sqlite' })
});
