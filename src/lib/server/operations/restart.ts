import type { Logger } from 'pino';
import type { RestartOptions } from './restart.interfaces';

const RESTART_DELAY_MS = 1500;

const FORCED_EXIT_MS = 20_000;

let maintenance = false;

export function inMaintenance(): boolean {
	return maintenance;
}

export function leaveMaintenance(): void {
	maintenance = false;
}

export function scheduleRestart(logger: Logger, options: RestartOptions = {}): void {
	const terminate = options.terminate ?? (() => process.kill(process.pid, 'SIGTERM'));
	const exit = options.exit ?? ((code: number) => process.exit(code));

	maintenance = true;
	setTimeout(() => {
		logger.info('Restarting to restore a backup');
		terminate();
		setTimeout(() => exit(0), options.forcedExitMs ?? FORCED_EXIT_MS).unref();
	}, options.delayMs ?? RESTART_DELAY_MS);
}
