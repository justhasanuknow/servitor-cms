export interface SessionSummary {
	id: string;
	current: boolean;
	browser: string | null;
	os: string | null;
	ipAddress: string | null;
	createdAt: Date;
	lastActiveAt: Date;
}
