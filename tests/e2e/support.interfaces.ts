export interface InvitedUser {
	name: string;
	email: string;
	role: 'Admin' | 'Author';
}

export interface CreatedUser extends InvitedUser {
	password: string;
}
