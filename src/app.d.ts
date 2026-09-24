import type { AuthSession, AuthUser } from '$lib/server/auth/auth';

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
		}
	}
}

export {};
