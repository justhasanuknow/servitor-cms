import type { AuthSession, AuthUser } from '$lib/server/auth/auth';
import type { UserPreferences } from '$lib/server/preferences/preferences.interfaces';

declare global {
	namespace App {
		interface Error {
			message: string;
			correlationId?: string;
		}

		interface Locals {
			requestId: string;
			user: AuthUser | null;
			session: AuthSession | null;
			preferences: UserPreferences | null;
		}
	}
}

export {};
