export interface LockoutEntry {
	failures: number;
	windowStart: number;
	lockedUntil: number | null;
}

export interface LockoutUpdate {
	locked: boolean;
	lockedNow: boolean;
}
