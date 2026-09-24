import type { USER_ROLES } from '../../constants/users';

export interface TestUserInput {
	email: string;
	password: string;
	role?: (typeof USER_ROLES)[number];
	name?: string;
	mustChangePassword?: boolean;
}
