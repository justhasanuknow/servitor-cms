export interface RestartOptions {
	delayMs?: number;
	forcedExitMs?: number;
	terminate?: () => void;
	exit?: (code: number) => void;
}
