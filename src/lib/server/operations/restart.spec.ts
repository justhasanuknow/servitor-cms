import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logging/logger';
import { inMaintenance, leaveMaintenance, scheduleRestart } from './restart';

afterEach(() => {
	leaveMaintenance();
	vi.useRealTimers();
});

describe('scheduleRestart', () => {
	it('answers with maintenance at once, stops the app and forces an exit if it hangs', () => {
		vi.useFakeTimers();

		const terminate = vi.fn();
		const exit = vi.fn();

		scheduleRestart(createLogger('silent'), {
			terminate,
			exit,
			delayMs: 100,
			forcedExitMs: 500
		});

		expect(inMaintenance()).toBe(true);
		expect(terminate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);

		expect(terminate).toHaveBeenCalledOnce();
		expect(exit).not.toHaveBeenCalled();

		vi.advanceTimersByTime(500);

		expect(exit).toHaveBeenCalledWith(0);
	});
});
