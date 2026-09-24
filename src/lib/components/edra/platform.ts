const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;

export function isApplePlatform(): boolean {
	return typeof navigator !== 'undefined' && APPLE_PLATFORM.test(navigator.userAgent);
}
