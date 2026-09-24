import type { Runtime } from '../runtime.interfaces';
import { publishDueTranslations } from './workflow';

const SCHEDULER_INTERVAL_MS = 60_000;

let stopActive: (() => void) | null = null;

export function startScheduler(runtime: Runtime): () => void {
	stopActive?.();

	const run = () => {
		try {
			const published = publishDueTranslations(runtime);

			if (published > 0) {
				runtime.logger.info({ published }, 'Published scheduled translations');
			}
		} catch (error) {
			runtime.logger.error(
				{ err: error },
				'The scheduler could not publish due translations'
			);
		}
	};
	const timer = setInterval(run, SCHEDULER_INTERVAL_MS);

	timer.unref();
	run();
	stopActive = () => {
		clearInterval(timer);
		stopActive = null;
	};

	return stopActive;
}
