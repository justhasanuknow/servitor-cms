import type { AuthSession, AuthUser } from './auth';

export interface Actor {
	user: AuthUser;
	session: AuthSession;
}
