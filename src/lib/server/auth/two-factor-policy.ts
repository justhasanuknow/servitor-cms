import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../db';
import { systemSettings } from '../db/schema';
import type { AuthUser } from './auth';

const ENFORCED_ROLES = new Set(['founder', 'admin']);

export function requiresTwoFactorEnrollment(db: AppDatabase, user: AuthUser | null): boolean {
	if (user === null || user.twoFactorEnabled === true || !ENFORCED_ROLES.has(user.role)) {
		return false;
	}

	const settings = db
		.select({ required: systemSettings.requireTwoFactorForAdmins })
		.from(systemSettings)
		.where(eq(systemSettings.id, 1))
		.get();

	return settings?.required === true;
}
