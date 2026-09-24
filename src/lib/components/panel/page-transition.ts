import type { OnNavigate } from '@sveltejs/kit';
import { prefersReducedMotion } from 'svelte/motion';

const TRANSITION_TIMEOUT_MS = 600;

const ANIMATED_NAVIGATIONS = new Set(['link', 'popstate']);

export function startPageTransition(navigation: OnNavigate): Promise<void> | undefined {
	if (typeof document.startViewTransition !== 'function' || prefersReducedMotion.current) {
		return undefined;
	}

	if (!ANIMATED_NAVIGATIONS.has(navigation.type)) {
		return undefined;
	}

	return new Promise((resolveTransition) => {
		document.startViewTransition(async () => {
			resolveTransition();
			await Promise.race([
				navigation.complete.catch(() => undefined),
				new Promise((settle) => setTimeout(settle, TRANSITION_TIMEOUT_MS))
			]);
		});
	});
}
