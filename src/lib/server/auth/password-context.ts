import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../db';
import { user } from '../db/schema';
import { loadSystemSettings } from '../settings/system-settings';
import type { PasswordContext } from './password-policy.interfaces';

export function passwordContextFor(
	db: DatabaseExecutor,
	origin: string,
	userId: string
): PasswordContext {
	const owner = db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, userId))
		.get();

	return {
		name: owner?.name ?? null,
		email: owner?.email ?? null,
		siteName: loadSystemSettings(db).siteName,
		origin
	};
}
