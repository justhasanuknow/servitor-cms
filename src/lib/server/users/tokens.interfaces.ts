import type { UserTokenType } from '../../constants/users';

export interface IssueTokenInput {
	userId: string;
	type: UserTokenType;
	createdBy: string | null;
	newEmail?: string | null;
}

export interface ActiveUserToken {
	id: string;
	userId: string;
	newEmail: string | null;
	expiresAt: Date;
}
