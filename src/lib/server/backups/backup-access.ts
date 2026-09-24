import type { AuthUser } from '../auth/auth';
import { requirePermission } from '../permissions/permissions';

export function requireBackupAccess(actor: AuthUser): boolean {
	requirePermission(actor, 'backup.manage', null);

	return actor.twoFactorEnabled === true;
}
