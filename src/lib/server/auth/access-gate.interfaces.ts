export interface PanelAccessState {
	pathname: string;
	signedIn: boolean;
	mustChangePassword: boolean;
	twoFactorEnrollmentRequired: boolean;
}
